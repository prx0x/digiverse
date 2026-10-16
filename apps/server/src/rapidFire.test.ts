import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { bootstrapAdmin } from './services/bootstrap.js';

describe('Build Phase 4 — Rapid-Fire Gameplay and Power-Up Acquisition', () => {
  let app: FastifyInstance;
  let sqlClient: ReturnType<typeof postgres>;
  const config = {
    ...loadConfig(),
    RATE_LIMIT_LOGIN_MAX: 1000,
    RATE_LIMIT_ACTIONS_MAX: 1000,
  };

  beforeAll(async () => {
    const { db, sql } = createDb(config);
    sqlClient = sql;
    await bootstrapAdmin(db, config);
    app = await buildApp({ config, db });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await sqlClient.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await sqlClient`TRUNCATE TABLE events CASCADE`;
    await sqlClient`TRUNCATE TABLE users CASCADE`;
    const { db } = createDb(config);
    await bootstrapAdmin(db, config);
  });

  async function getCsrf() {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    const body = res.json();
    const cookie = res.cookies.find((c) => c.name === config.csrfCookieName)?.value;
    return { token: body.csrfToken as string, cookie: cookie as string };
  }

  async function loginAdmin() {
    const csrf = await getCsrf();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-csrf-token': csrf.token },
      cookies: { [config.csrfCookieName]: csrf.cookie },
      payload: {
        identifier: config.ADMIN_BOOTSTRAP_USER_ID,
        password: config.ADMIN_BOOTSTRAP_PASSWORD,
      },
    });
    const session = res.cookies.find((c) => c.name === config.sessionCookieName)!.value;
    return { csrf, session };
  }

  async function createTeam(adminSession: string, csrf: { token: string; cookie: string }, name: string) {
    const identifier = `team_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
    const password = 'Password123!Secure';
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/teams',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { identifier, password, name },
    });
    const createdTeam = createRes.json().team;

    const teamCsrf = await getCsrf();
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-csrf-token': teamCsrf.token },
      cookies: { [config.csrfCookieName]: teamCsrf.cookie },
      payload: { identifier, password },
    });
    const teamSession = loginRes.cookies.find((c) => c.name === config.sessionCookieName)!.value;

    return {
      id: createdTeam.id as string,
      name,
      identifier,
      csrf: teamCsrf,
      session: teamSession,
    };
  }

  async function setupEventWithQuestion(adminSession: string, csrf: { token: string; cookie: string }) {
    // 1. Fetch default event
    const eventRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/event',
      cookies: { [config.sessionCookieName]: adminSession },
    });
    const bundle = eventRes.json();
    const eventId = bundle.event.id;

    // 2. Configure card supply
    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/card-supply',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: {
        items: [
          { cardType: 'SHIELD', maxSupply: 5 },
          { cardType: 'RESERVE', maxSupply: 1 },
          { cardType: 'PEEK', maxSupply: 5 },
          { cardType: 'REVERSE', maxSupply: 5 },
        ],
      },
    });

    // 3. Configure Phase B round with statCard so event can mark READY
    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/rounds',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: {
        rounds: [{ roundNumber: 1, statCard: 'MEAN', timerSeconds: 60 }],
      },
    });

    // 4. Create question set
    const setRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/question-sets',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { name: 'Rapid Fire Set 1' },
    });
    const setId = setRes.json().questionSets[0].id;

    // 5. Create question mapped to SHIELD, top-N: 2
    const qRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/question-sets/${setId}/questions`,
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: {
        prompt: 'What is the capital of France?',
        answerDefinition: 'Paris',
        matchingMode: 'NORMALIZED',
        timeLimitSeconds: 15,
        mappedCard: 'SHIELD',
        topN: 2,
      },
    });
    expect(qRes.statusCode).toBe(200);
    const qSet = qRes.json().questionSets.find((s: { id: string }) => s.id === setId);
    const question = qSet.questions[0];

    // 6. Transition event to READY and LIVE so rapid fire can run
    const readyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/event/lifecycle',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { status: 'READY' },
    });
    expect(readyRes.statusCode).toBe(200);

    const liveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/event/lifecycle',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { status: 'LIVE' },
    });
    expect(liveRes.statusCode).toBe(200);

    return { eventId, setId, question };
  }

  it('enforces RBAC on rapid fire admin endpoints', async () => {
    const { csrf, session: adminSession } = await loginAdmin();
    const team = await createTeam(adminSession, csrf, 'Team Beta');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/start',
      headers: { 'x-csrf-token': team.csrf.token },
      cookies: {
        [config.csrfCookieName]: team.csrf.cookie,
        [config.sessionCookieName]: team.session,
      },
      payload: { questionId: '00000000-0000-0000-0000-000000000000' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('protects question answer from leaking to team clients', async () => {
    const { csrf, session: adminSession } = await loginAdmin();
    const { question } = await setupEventWithQuestion(adminSession, csrf);
    const team = await createTeam(adminSession, csrf, 'Team Alpha');

    // Admin opens question
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/start',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { questionId: question.id },
    });

    // Team fetches current view
    const teamRes = await app.inject({
      method: 'GET',
      url: '/api/v1/rapid-fire/current',
      cookies: { [config.sessionCookieName]: team.session },
    });

    expect(teamRes.statusCode).toBe(200);
    const body = teamRes.json();
    expect(body.status).toBe('QUESTION_OPEN');
    expect(body.question.prompt).toBe('What is the capital of France?');
    expect(body.question.timeLimitSeconds).toBe(15);
    // CRITICAL: answerDefinition must NEVER be present
    expect(body.question.answerDefinition).toBeUndefined();
    expect(body.teamSubmission.canSubmit).toBe(true);
  });

  it('runs full concurrent rapid fire submission, evaluation, and award allocation', async () => {
    const { csrf, session: adminSession } = await loginAdmin();
    const { question } = await setupEventWithQuestion(adminSession, csrf);

    const team1 = await createTeam(adminSession, csrf, 'Team One');
    const team2 = await createTeam(adminSession, csrf, 'Team Two');
    const team3 = await createTeam(adminSession, csrf, 'Team Three');

    // Start question
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/start',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { questionId: question.id },
    });
    expect(startRes.statusCode).toBe(200);

    // Starting another question while one is open is rejected
    const startAgainRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/start',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { questionId: question.id },
    });
    expect(startAgainRes.statusCode).toBe(409);

    // Simulate concurrent submissions
    // Team 1: correct 'paris'
    // Team 2: incorrect 'london'
    // Team 3: correct 'Paris'
    const [sub1, sub2, sub3] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/rapid-fire/answers',
        headers: { 'x-csrf-token': team1.csrf.token },
        cookies: {
          [config.csrfCookieName]: team1.csrf.cookie,
          [config.sessionCookieName]: team1.session,
        },
        payload: { questionId: question.id, answer: 'paris' },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/rapid-fire/answers',
        headers: { 'x-csrf-token': team2.csrf.token },
        cookies: {
          [config.csrfCookieName]: team2.csrf.cookie,
          [config.sessionCookieName]: team2.session,
        },
        payload: { questionId: question.id, answer: 'london' },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/rapid-fire/answers',
        headers: { 'x-csrf-token': team3.csrf.token },
        cookies: {
          [config.csrfCookieName]: team3.csrf.cookie,
          [config.sessionCookieName]: team3.session,
        },
        payload: { questionId: question.id, answer: 'Paris' },
      }),
    ]);

    expect(sub1.statusCode).toBe(200);
    expect(sub1.json().isCorrect).toBe(true);
    expect(sub2.statusCode).toBe(200);
    expect(sub2.json().isCorrect).toBe(false);
    expect(sub3.statusCode).toBe(200);
    expect(sub3.json().isCorrect).toBe(true);

    // Team 1 attempts duplicate submission -> rejected because maxAttempts = 1
    const sub1Duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/rapid-fire/answers',
      headers: { 'x-csrf-token': team1.csrf.token },
      cookies: {
        [config.csrfCookieName]: team1.csrf.cookie,
        [config.sessionCookieName]: team1.session,
      },
      payload: { questionId: question.id, answer: 'paris again' },
    });
    expect(sub1Duplicate.statusCode).toBe(400);
    expect(sub1Duplicate.json().error.code).toBe('ATTEMPTS_EXCEEDED');

    // Admin closes question
    const closeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/close',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
    });
    expect(closeRes.statusCode).toBe(200);
    expect(closeRes.json().session.status).toBe('CLOSED');

    // Submissions after question is closed are rejected
    const lateSub = await app.inject({
      method: 'POST',
      url: '/api/v1/rapid-fire/answers',
      headers: { 'x-csrf-token': team2.csrf.token },
      cookies: {
        [config.csrfCookieName]: team2.csrf.cookie,
        [config.sessionCookieName]: team2.session,
      },
      payload: { questionId: question.id, answer: 'late answer' },
    });
    expect(lateSub.statusCode).toBe(400);
    expect(lateSub.json().error.code).toBe('QUESTION_CLOSED');

    // Admin awards cards (topN = 2, so team1 and team3 should get SHIELD)
    const awardRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/award',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
    });
    expect(awardRes.statusCode).toBe(200);
    const awards = awardRes.json().awards;
    expect(awards).toHaveLength(2);
    const winnerIds = awards.map((a: { teamId: string }) => a.teamId);
    expect(winnerIds).toContain(team1.id);
    expect(winnerIds).toContain(team3.id);
    expect(winnerIds).not.toContain(team2.id);

    // Verify Team 1's inventory via /teams/me/cards and /teams/me
    const team1CardsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/teams/me/cards',
      cookies: { [config.sessionCookieName]: team1.session },
    });
    expect(team1CardsRes.statusCode).toBe(200);
    expect(team1CardsRes.json().cards).toHaveLength(1);
    expect(team1CardsRes.json().cards[0].cardType).toBe('SHIELD');

    const team1MeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/teams/me',
      cookies: { [config.sessionCookieName]: team1.session },
    });
    expect(team1MeRes.statusCode).toBe(200);
    expect(team1MeRes.json().inventorySummary.cards).toEqual([{ card: 'SHIELD', count: 1 }]);

    // Team 2 (did not win) inventory is empty
    const team2CardsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/teams/me/cards',
      cookies: { [config.sessionCookieName]: team2.session },
    });
    expect(team2CardsRes.json().cards).toHaveLength(0);

    // Reconnecting client recovers state: team view shows won: true for team 1
    const reconnectRes = await app.inject({
      method: 'GET',
      url: '/api/v1/rapid-fire/current',
      cookies: { [config.sessionCookieName]: team1.session },
    });
    expect(reconnectRes.json().status).toBe('AWARDED');
    expect(reconnectRes.json().award.won).toBe(true);
    expect(reconnectRes.json().award.cardType).toBe('SHIELD');

    // Admin audit trail check
    const adminStateRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/rapid-fire/state',
      cookies: { [config.sessionCookieName]: adminSession },
    });
    expect(adminStateRes.statusCode).toBe(200);
    const adminState = adminStateRes.json();
    expect(adminState.submissions).toHaveLength(3);
    expect(adminState.awards).toHaveLength(2);
    // Supply was decremented
    expect(adminState.remainingCardSupply.SHIELD).toBe(3); // 5 max - 2 awarded = 3
  });

  it('strictly limits RESERVE card awards to 1', async () => {
    const { csrf, session: adminSession } = await loginAdmin();

    // Configure card supply
    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/card-supply',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: {
        items: [
          { cardType: 'SHIELD', maxSupply: 5 },
          { cardType: 'RESERVE', maxSupply: 1 },
          { cardType: 'PEEK', maxSupply: 5 },
          { cardType: 'REVERSE', maxSupply: 5 },
        ],
      },
    });

    // Configure Phase B round with statCard
    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/rounds',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: {
        rounds: [{ roundNumber: 1, statCard: 'MEAN', timerSeconds: 60 }],
      },
    });

    // Create question set
    const setRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/question-sets',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { name: 'Reserve Test Set' },
    });
    const setId = setRes.json().questionSets[0].id;

    // Create question mapped to RESERVE with topN: 1 (Reserve maxSupply = 1)
    const qRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/question-sets/${setId}/questions`,
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: {
        prompt: '2 + 2 = ?',
        answerDefinition: '4',
        matchingMode: 'EXACT',
        timeLimitSeconds: 15,
        mappedCard: 'RESERVE',
        topN: 1,
      },
    });
    expect(qRes.statusCode).toBe(200);
    const question = qRes.json().questionSets[0].questions[0];

    // Transition to READY and LIVE
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/event/lifecycle',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { status: 'READY' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/event/lifecycle',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { status: 'LIVE' },
    });

    const teamA = await createTeam(adminSession, csrf, 'Team A');
    const teamB = await createTeam(adminSession, csrf, 'Team B');

    // Start question
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/start',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { questionId: question.id },
    });

    // Both teams answer correctly
    await app.inject({
      method: 'POST',
      url: '/api/v1/rapid-fire/answers',
      headers: { 'x-csrf-token': teamA.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamA.csrf.cookie,
        [config.sessionCookieName]: teamA.session,
      },
      payload: { questionId: question.id, answer: '4' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/rapid-fire/answers',
      headers: { 'x-csrf-token': teamB.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamB.csrf.cookie,
        [config.sessionCookieName]: teamB.session,
      },
      payload: { questionId: question.id, answer: '4' },
    });

    // Award question
    const awardRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/award',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
    });

    // Exactly 1 Reserve card awarded
    const awards = awardRes.json().awards;
    expect(awards).toHaveLength(1);
    expect(awards[0].cardType).toBe('RESERVE');
  });
});
