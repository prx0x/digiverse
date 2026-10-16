import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { scoreLedger } from './db/schema.js';
import { bootstrapAdmin } from './services/bootstrap.js';
import { eq } from 'drizzle-orm';

describe('Build Phase 6 — Full End-to-End System Playthrough', () => {
  let app: FastifyInstance;
  let sqlClient: ReturnType<typeof postgres>;
  let dbClient: ReturnType<typeof createDb>['db'];
  const config = {
    ...loadConfig(),
    RATE_LIMIT_LOGIN_MAX: 1000,
    RATE_LIMIT_ACTIONS_MAX: 1000,
  };

  beforeAll(async () => {
    const { db, sql } = createDb(config);
    dbClient = db;
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
    dbClient = db;
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

  async function createTeam(adminSession: string, csrf: { token: string; cookie: string }, name: string, tag: string) {
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
      payload: { identifier, password, name, tag },
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
    expect(loginRes.statusCode).toBe(200);
    const teamSession = loginRes.cookies.find((c) => c.name === config.sessionCookieName)!.value;

    return {
      id: createdTeam.id as string,
      name,
      tag,
      identifier,
      csrf: teamCsrf,
      session: teamSession,
    };
  }

  it('runs complete lifecycle: account provisioning -> event config -> rapid fire awards -> main game rounds -> 4-dp leaderboard -> void recovery', async () => {
    // 1. Admin login
    const admin = await loginAdmin();

    // 2. Team creation: 4 teams
    const teamAlpha = await createTeam(admin.session, admin.csrf, 'Alpha Team', 'ALP');
    const teamBeta = await createTeam(admin.session, admin.csrf, 'Beta Squad', 'BET');
    const teamGamma = await createTeam(admin.session, admin.csrf, 'Gamma Force', 'GAM');
    const teamDelta = await createTeam(admin.session, admin.csrf, 'Delta Crew', 'DEL');

    // 3. Event configuration (DRAFT phase)
    // Configure counts
    const putEventRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/event',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: {
        gamePhaseARoundCount: 3,
        gamePhaseBRoundCount: 2,
        roundSelectionSeconds: 45,
        statCardAnnouncementSeconds: 15,
        rapidFireDefaultTimeLimitSeconds: 30,
      },
    });
    expect(putEventRes.statusCode).toBe(200);

    // Configure stat cards + timerSeconds for Phase B rounds
    const putRoundsRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/rounds',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: {
        rounds: [
          { roundNumber: 1, statCard: 'MEAN', timerSeconds: 60 },
          { roundNumber: 2, statCard: 'TWO_THIRDS', timerSeconds: 60 },
        ],
      },
    });
    expect(putRoundsRes.statusCode).toBe(200);

    // Configure card supply
    const putSupplyRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/card-supply',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: {
        items: [
          { cardType: 'SHIELD', maxSupply: 10 },
          { cardType: 'RESERVE', maxSupply: 1 },
          { cardType: 'PEEK', maxSupply: 10 },
          { cardType: 'REVERSE', maxSupply: 10 },
        ],
      },
    });
    expect(putSupplyRes.statusCode).toBe(200);

    // Create question set
    const setRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/question-sets',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: { name: 'Rapid Fire Set 1' },
    });
    expect(setRes.statusCode).toBe(200);
    // The bundle is returned; find the set by name
    const bundle = setRes.json();
    const setId = bundle.questionSets.find((s: { name: string; id: string }) => s.name === 'Rapid Fire Set 1')!.id as string;

    // Q1: SHIELD, topN=2
    const q1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/question-sets/${setId}/questions`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: {
        prompt: 'What club is hosting Digiverse?',
        matchingMode: 'NORMALIZED',
        answerDefinition: 'GDGoC',
        mappedCard: 'SHIELD',
        topN: 2,
        timeLimitSeconds: 30,
      },
    });
    expect(q1Res.statusCode).toBe(200);
    const q1Id = q1Res.json().questionSets
      .find((s: { id: string }) => s.id === setId)!
      .questions.at(-1)!.id as string;

    // Q2: RESERVE, topN=1
    const q2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/question-sets/${setId}/questions`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: {
        prompt: 'What is 40 + 2?',
        matchingMode: 'NUMERIC',
        answerDefinition: '42',
        mappedCard: 'RESERVE',
        topN: 1,
        timeLimitSeconds: 30,
      },
    });
    expect(q2Res.statusCode).toBe(200);
    const q2Id = q2Res.json().questionSets
      .find((s: { id: string }) => s.id === setId)!
      .questions.at(-1)!.id as string;

    // Q3: REVERSE, topN=2
    const q3Res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/question-sets/${setId}/questions`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: {
        prompt: 'Binary is base what?',
        matchingMode: 'NUMERIC',
        answerDefinition: '2',
        mappedCard: 'REVERSE',
        topN: 2,
        timeLimitSeconds: 30,
      },
    });
    expect(q3Res.statusCode).toBe(200);
    const q3Id = q3Res.json().questionSets
      .find((s: { id: string }) => s.id === setId)!
      .questions.at(-1)!.id as string;

    // Get event id
    const eventBundleRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/event',
      cookies: { [config.sessionCookieName]: admin.session },
    });
    const eventId = eventBundleRes.json().event.id as string;

    // 4. Transition: DRAFT -> READY -> LIVE
    const readyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/event/lifecycle',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: { status: 'READY' },
    });
    if (readyRes.statusCode !== 200) {
      console.error('READY transition failed:', readyRes.json());
    }
    expect(readyRes.statusCode).toBe(200);

    const liveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/event/lifecycle',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: { status: 'LIVE' },
    });
    expect(liveRes.statusCode).toBe(200);

    // 5. Rapid Fire — Phase A

    // Q1: Alpha + Beta answer correctly → both get SHIELD (topN=2)
    const startQ1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/start',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
      payload: { questionId: q1Id },
    });
    expect(startQ1Res.statusCode).toBe(200);

    await app.inject({
      method: 'POST',
      url: '/api/v1/rapid-fire/answers',
      headers: { 'x-csrf-token': teamAlpha.csrf.token },
      cookies: { [config.csrfCookieName]: teamAlpha.csrf.cookie, [config.sessionCookieName]: teamAlpha.session },
      payload: { questionId: q1Id, answer: 'gdgoc' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/rapid-fire/answers',
      headers: { 'x-csrf-token': teamBeta.csrf.token },
      cookies: { [config.csrfCookieName]: teamBeta.csrf.cookie, [config.sessionCookieName]: teamBeta.session },
      payload: { questionId: q1Id, answer: 'GDGoC' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/rapid-fire/answers',
      headers: { 'x-csrf-token': teamGamma.csrf.token },
      cookies: { [config.csrfCookieName]: teamGamma.csrf.cookie, [config.sessionCookieName]: teamGamma.session },
      payload: { questionId: q1Id, answer: 'WrongAnswer' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/close',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
    });

    const award1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/award',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
    });
    expect(award1Res.statusCode).toBe(200);
    expect(award1Res.json().awards).toHaveLength(2); // Alpha + Beta get SHIELD

    // Q2: Alpha answers 42 correctly → gets RESERVE (topN=1)
    const startQ2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/start',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
      payload: { questionId: q2Id },
    });
    expect(startQ2Res.statusCode).toBe(200);

    await app.inject({
      method: 'POST',
      url: '/api/v1/rapid-fire/answers',
      headers: { 'x-csrf-token': teamAlpha.csrf.token },
      cookies: { [config.csrfCookieName]: teamAlpha.csrf.cookie, [config.sessionCookieName]: teamAlpha.session },
      payload: { questionId: q2Id, answer: '42' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/close',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
    });
    const award2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/award',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
    });
    expect(award2Res.statusCode).toBe(200);
    expect(award2Res.json().awards).toHaveLength(1); // Alpha gets RESERVE

    // Q3: Beta + Gamma both answer correctly → get REVERSE (topN=2)
    const startQ3Res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/start',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
      payload: { questionId: q3Id },
    });
    expect(startQ3Res.statusCode).toBe(200);

    await app.inject({
      method: 'POST',
      url: '/api/v1/rapid-fire/answers',
      headers: { 'x-csrf-token': teamBeta.csrf.token },
      cookies: { [config.csrfCookieName]: teamBeta.csrf.cookie, [config.sessionCookieName]: teamBeta.session },
      payload: { questionId: q3Id, answer: '2' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/rapid-fire/answers',
      headers: { 'x-csrf-token': teamGamma.csrf.token },
      cookies: { [config.csrfCookieName]: teamGamma.csrf.cookie, [config.sessionCookieName]: teamGamma.session },
      payload: { questionId: q3Id, answer: '2' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/close',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rapid-fire/award',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
    });

    // Verify Alpha inventory: SHIELD + RESERVE
    const alphaCardsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/teams/me/cards',
      cookies: { [config.sessionCookieName]: teamAlpha.session },
    });
    expect(alphaCardsRes.statusCode).toBe(200);
    const alphaCardTypes = alphaCardsRes.json().cards.map((c: { cardType: string }) => c.cardType);
    expect(alphaCardTypes).toContain('SHIELD');
    expect(alphaCardTypes).toContain('RESERVE');

    // 6. Main Game — Round 1: MEAN
    const startR1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rounds/start',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
      payload: {
        statCard: 'MEAN',
        lobbySeconds: 15,
        selectionSeconds: 60,
      },
    });
    expect(startR1Res.statusCode).toBe(200);
    const round1Id = startR1Res.json().round.id as string;

    // Beta plays SHIELD in Lobby (before selection opens)
    const shieldRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/cards/play',
      headers: { 'x-csrf-token': teamBeta.csrf.token },
      cookies: { [config.csrfCookieName]: teamBeta.csrf.cookie, [config.sessionCookieName]: teamBeta.session },
      payload: { cardType: 'SHIELD' },
    });
    expect(shieldRes.statusCode).toBe(200);

    // Alpha plays RESERVE to secure number 42 in Lobby
    const reserveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/cards/play',
      headers: { 'x-csrf-token': teamAlpha.csrf.token },
      cookies: { [config.csrfCookieName]: teamAlpha.csrf.cookie, [config.sessionCookieName]: teamAlpha.session },
      payload: { cardType: 'RESERVE', reservedNumber: 42 },
    });
    expect(reserveRes.statusCode).toBe(200);

    // Open selection
    const openR1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${round1Id}/open-selection`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
    });
    expect(openR1Res.statusCode).toBe(200);

    // Beta + Gamma clash on 50; Delta picks 60; Alpha auto-reserved 42
    await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamBeta.csrf.token },
      cookies: { [config.csrfCookieName]: teamBeta.csrf.cookie, [config.sessionCookieName]: teamBeta.session },
      payload: { pick: 50 },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamGamma.csrf.token },
      cookies: { [config.csrfCookieName]: teamGamma.csrf.cookie, [config.sessionCookieName]: teamGamma.session },
      payload: { pick: 50 },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamDelta.csrf.token },
      cookies: { [config.csrfCookieName]: teamDelta.csrf.cookie, [config.sessionCookieName]: teamDelta.session },
      payload: { pick: 60 },
    });

    // Resolve Round 1: valid picks = {Alpha:42, Delta:60}, mean = 51
    const resolveR1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${round1Id}/resolve`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
    });
    expect(resolveR1Res.statusCode).toBe(200);
    const r1Result = resolveR1Res.json();
    // {42, 60} mean = 51
    expect(r1Result.result.displayTarget).toBe('51.0000');

    // 7. Main Game — Round 2: TWO_THIRDS with a REVERSE play
    const startR2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rounds/start',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
      payload: {
        statCard: 'TWO_THIRDS',
        lobbySeconds: 15,
        selectionSeconds: 60,
      },
    });
    expect(startR2Res.statusCode).toBe(200);
    const round2Id = startR2Res.json().round.id as string;

    const openR2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${round2Id}/open-selection`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
    });
    expect(openR2Res.statusCode).toBe(200);

    // Beta plays REVERSE during selection
    const reversePlayRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/cards/play',
      headers: { 'x-csrf-token': teamBeta.csrf.token },
      cookies: { [config.csrfCookieName]: teamBeta.csrf.cookie, [config.sessionCookieName]: teamBeta.session },
      payload: { cardType: 'REVERSE' },
    });
    expect(reversePlayRes.statusCode).toBe(200);

    // All 4 teams submit distinct picks
    await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamAlpha.csrf.token },
      cookies: { [config.csrfCookieName]: teamAlpha.csrf.cookie, [config.sessionCookieName]: teamAlpha.session },
      payload: { pick: 30 },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamBeta.csrf.token },
      cookies: { [config.csrfCookieName]: teamBeta.csrf.cookie, [config.sessionCookieName]: teamBeta.session },
      payload: { pick: 45 },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamGamma.csrf.token },
      cookies: { [config.csrfCookieName]: teamGamma.csrf.cookie, [config.sessionCookieName]: teamGamma.session },
      payload: { pick: 60 },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamDelta.csrf.token },
      cookies: { [config.csrfCookieName]: teamDelta.csrf.cookie, [config.sessionCookieName]: teamDelta.session },
      payload: { pick: 75 },
    });

    const resolveR2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${round2Id}/resolve`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
    });
    expect(resolveR2Res.statusCode).toBe(200);
    expect(resolveR2Res.json().result.isReversed).toBe(true);

    // 8. Leaderboard validation — 4 decimal places enforced everywhere
    const lbRes = await app.inject({
      method: 'GET',
      url: '/api/v1/leaderboard',
      cookies: { [config.sessionCookieName]: teamAlpha.session },
    });
    expect(lbRes.statusCode).toBe(200);
    const leaderboard = lbRes.json().leaderboard;
    expect(leaderboard).toHaveLength(4);

    for (const entry of leaderboard) {
      // Strictly 4 decimal places
      expect(entry.displayScore).toMatch(/^-?\d+\.\d{4}$/);
      expect(typeof entry.rank).toBe('number');
      expect(entry.rank).toBeGreaterThanOrEqual(1);
    }

    // Admin sees same leaderboard
    const adminLbRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/leaderboard',
      cookies: { [config.sessionCookieName]: admin.session },
    });
    expect(adminLbRes.statusCode).toBe(200);
    expect(adminLbRes.json().leaderboard).toEqual(leaderboard);

    // Score ledger has audit trail
    const ledger = await dbClient.select().from(scoreLedger).where(eq(scoreLedger.eventId, eventId));
    expect(ledger.length).toBeGreaterThan(0);

    // 9. Void round 2 — verify ledger reversal
    const voidRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${round2Id}/void`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: { [config.csrfCookieName]: admin.csrf.cookie, [config.sessionCookieName]: admin.session },
      payload: { reason: 'E2E void test' },
    });
    expect(voidRes.statusCode).toBe(200);

    const lbAfterVoidRes = await app.inject({
      method: 'GET',
      url: '/api/v1/leaderboard',
      cookies: { [config.sessionCookieName]: teamAlpha.session },
    });
    expect(lbAfterVoidRes.statusCode).toBe(200);
    const afterVoidLb = lbAfterVoidRes.json().leaderboard;
    expect(afterVoidLb).toHaveLength(4);

    // All scores still 4 dp after void
    for (const entry of afterVoidLb) {
      expect(entry.displayScore).toMatch(/^-?\d+\.\d{4}$/);
    }

    // Delta's score should change after void (Round 2 was reversed, voiding it should affect scores)
    const deltaBeforeVoid = leaderboard.find((e: { teamId: string }) => e.teamId === teamDelta.id)!.rawScore;
    const deltaAfterVoid = afterVoidLb.find((e: { teamId: string }) => e.teamId === teamDelta.id)!.rawScore;
    // After voiding Round 2, Delta should be back to Round 1 score only
    expect(deltaBeforeVoid).not.toBe(deltaAfterVoid);
  });
});
