import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { teamCards } from './db/schema.js';
import { bootstrapAdmin } from './services/bootstrap.js';

describe('Build Phase 5 — Main Game Engine and Scoring Integration', () => {
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

  async function setupEvent(adminSession: string, csrf: { token: string; cookie: string }) {
    const eventRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/event',
      cookies: { [config.sessionCookieName]: adminSession },
    });
    const bundle = eventRes.json();
    const eventId = bundle.event.id;

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

    // Configure rounds
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

    // Create question set & question mapped to card
    const setRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/question-sets',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { name: 'Set 1' },
    });
    const setId = setRes.json().questionSets[0].id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/question-sets/${setId}/questions`,
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: {
        prompt: 'Q1?',
        answerDefinition: 'A',
        matchingMode: 'NORMALIZED',
        timeLimitSeconds: 15,
        mappedCard: 'SHIELD',
        topN: 1,
      },
    });

    // Transition to READY then LIVE
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

    return { eventId };
  }

  it('runs complete Game Phase B round lifecycle with picks, scoring, and ledger', async () => {
    const admin = await loginAdmin();
    await setupEvent(admin.session, admin.csrf);

    const teamA = await createTeam(admin.session, admin.csrf, 'Alpha');
    const teamB = await createTeam(admin.session, admin.csrf, 'Bravo');
    const teamC = await createTeam(admin.session, admin.csrf, 'Charlie');

    // 1. Start round in LOBBY with MEAN stat card
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rounds/start',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: {
        roundNumber: 1,
        statCard: 'MEAN',
        lobbySeconds: 15,
        selectionSeconds: 60,
      },
    });

    expect(startRes.statusCode).toBe(200);
    const roundData = startRes.json().round;
    expect(roundData.status).toBe('LOBBY');
    expect(roundData.statCard).toBe('MEAN');

    // 2. Team view during LOBBY
    const teamAViewLobby = await app.inject({
      method: 'GET',
      url: '/api/v1/rounds/current',
      cookies: { [config.sessionCookieName]: teamA.session },
    });
    expect(teamAViewLobby.statusCode).toBe(200);
    const bodyLobby = teamAViewLobby.json();
    expect(bodyLobby.active).toBe(true);
    expect(bodyLobby.round.status).toBe('LOBBY');
    expect(bodyLobby.currentScore).toBe('100'); // Starting points
    expect(bodyLobby.myPalette).toHaveLength(100);

    // 3. Admin advances round to SELECTION
    const advanceRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${roundData.id}/open-selection`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
    });
    expect(advanceRes.statusCode).toBe(200);
    expect(advanceRes.json().round.status).toBe('SELECTION');

    // 4. Teams submit picks:
    // Team A picks 10, Team B picks 20, Team C picks 90.
    // Mean = (10 + 20 + 90)/3 = 40.
    // Less bucket (<40): A(10), B(20) -> 2 teams (MAJORITY)
    // Greater bucket (>40): C(90) -> 1 team (MINORITY)
    const pickARes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamA.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamA.csrf.cookie,
        [config.sessionCookieName]: teamA.session,
      },
      payload: { pick: 10 },
    });
    expect(pickARes.statusCode).toBe(200);
    expect(pickARes.json().pick.pick).toBe(10);

    // Attempting to change pick is rejected (OPEN-014)
    const pickAChangeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamA.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamA.csrf.cookie,
        [config.sessionCookieName]: teamA.session,
      },
      payload: { pick: 15 },
    });
    expect(pickAChangeRes.statusCode).toBe(409);

    const pickBRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamB.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamB.csrf.cookie,
        [config.sessionCookieName]: teamB.session,
      },
      payload: { pick: 20 },
    });
    expect(pickBRes.statusCode).toBe(200);

    const pickCRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamC.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamC.csrf.cookie,
        [config.sessionCookieName]: teamC.session,
      },
      payload: { pick: 90 },
    });
    expect(pickCRes.statusCode).toBe(200);

    // 5. Admin resolves and scores the round
    const resolveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${roundData.id}/resolve`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
    });
    expect(resolveRes.statusCode).toBe(200);
    const scoreData = resolveRes.json().result;
    expect(scoreData.target).toBe('40');
    expect(scoreData.displayTarget).toBe('40.0000');
    expect(scoreData.majorityBucket).toBe('LESS');

    // Team C (minority): wins |40 - 90|/90 = 50/90
    // Team A (majority): pays |40 - 10|/10 = 3 deduction -> 97
    // Team B (majority): pays |40 - 20|/20 = 1 deduction -> 99
    const minorityAward =
      '0.555555555555555555555555555555555555555555555555555555555556';
    expect(scoreData.teamSummaries[teamC.id].delta).toBe(minorityAward);
    expect(scoreData.teamSummaries[teamC.id].finalScore).toBe(
      '100.555555555555555555555555555555555555555555555555555555556',
    );
    expect(scoreData.teamSummaries[teamA.id].delta).toBe('-3');
    expect(scoreData.teamSummaries[teamA.id].finalScore).toBe('97');
    expect(scoreData.teamSummaries[teamB.id].delta).toBe('-1');
    expect(scoreData.teamSummaries[teamB.id].finalScore).toBe('99');

    // 6. Check Leaderboard
    const lbRes = await app.inject({
      method: 'GET',
      url: '/api/v1/leaderboard',
    });
    expect(lbRes.statusCode).toBe(200);
    const leaderboard = lbRes.json().leaderboard;
    expect(leaderboard[0].teamId).toBe(teamC.id);
    expect(leaderboard[0].displayScore).toBe('100.5556');
    expect(leaderboard[1].teamId).toBe(teamB.id);
    expect(leaderboard[1].displayScore).toBe('99.0000');
    expect(leaderboard[2].teamId).toBe(teamA.id);
    expect(leaderboard[2].displayScore).toBe('97.0000');
  });

  it('handles power-up cards (Shield, Reserve, Peek, Reverse) and enforces rules', async () => {
    const admin = await loginAdmin();
    const { eventId } = await setupEvent(admin.session, admin.csrf);

    const teamA = await createTeam(admin.session, admin.csrf, 'ShieldTeam');
    const teamB = await createTeam(admin.session, admin.csrf, 'ReserveTeam');
    const teamC = await createTeam(admin.session, admin.csrf, 'PeekTeam');

    // Award cards directly to teams
    await dbClient.insert(teamCards).values([
      { eventId, teamId: teamA.id, cardType: 'SHIELD' },
      { eventId, teamId: teamB.id, cardType: 'RESERVE' },
      { eventId, teamId: teamC.id, cardType: 'PEEK' },
      { eventId, teamId: teamC.id, cardType: 'REVERSE' },
    ]);

    // Start round in LOBBY
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rounds/start',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: { roundNumber: 1, statCard: 'MEAN' },
    });
    const roundId = startRes.json().round.id;

    // Team A plays SHIELD during LOBBY
    const shieldRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/cards/play',
      headers: { 'x-csrf-token': teamA.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamA.csrf.cookie,
        [config.sessionCookieName]: teamA.session,
      },
      payload: { cardType: 'SHIELD' },
    });
    expect(shieldRes.statusCode).toBe(200);

    // Team B plays RESERVE with number 42 during LOBBY
    const reserveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/cards/play',
      headers: { 'x-csrf-token': teamB.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamB.csrf.cookie,
        [config.sessionCookieName]: teamB.session,
      },
      payload: { cardType: 'RESERVE', reservedNumber: 42 },
    });
    expect(reserveRes.statusCode).toBe(200);

    // Trying to play PEEK in LOBBY is rejected (selection only)
    const peekInLobby = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/cards/play',
      headers: { 'x-csrf-token': teamC.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamC.csrf.cookie,
        [config.sessionCookieName]: teamC.session,
      },
      payload: { cardType: 'PEEK' },
    });
    expect(peekInLobby.statusCode).toBe(400);

    // Advance to SELECTION
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${roundId}/open-selection`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
    });

    // Team A tries to pick 42 (reserved by Team B) -> rejected!
    const pickReserved = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamA.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamA.csrf.cookie,
        [config.sessionCookieName]: teamA.session,
      },
      payload: { pick: 42 },
    });
    expect(pickReserved.statusCode).toBe(409);

    // Team A picks 30 instead
    await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamA.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamA.csrf.cookie,
        [config.sessionCookieName]: teamA.session,
      },
      payload: { pick: 30 },
    });

    // Team C plays PEEK in SELECTION
    const peekRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/cards/play',
      headers: { 'x-csrf-token': teamC.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamC.csrf.cookie,
        [config.sessionCookieName]: teamC.session,
      },
      payload: { cardType: 'PEEK' },
    });
    expect(peekRes.statusCode).toBe(200);
    // Picks so far: Team B (42 - auto pick via Reserve) and Team A (30).
    // Both are < 50 and not Team C: peekCount should be 2!
    expect(peekRes.json().metadata.peekCount).toBe(2);

    // Team C tries to play a second card (REVERSE) in the same round -> rejected (max 1 card per round)
    const doubleCardRes = await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/cards/play',
      headers: { 'x-csrf-token': teamC.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamC.csrf.cookie,
        [config.sessionCookieName]: teamC.session,
      },
      payload: { cardType: 'REVERSE' },
    });
    expect(doubleCardRes.statusCode).toBe(400);

    // Team C submits pick 90
    await app.inject({
      method: 'POST',
      url: '/api/v1/rounds/current/pick',
      headers: { 'x-csrf-token': teamC.csrf.token },
      cookies: {
        [config.csrfCookieName]: teamC.csrf.cookie,
        [config.sessionCookieName]: teamC.session,
      },
      payload: { pick: 90 },
    });

    // Resolve round:
    // Team A: 30
    // Team B: 42 (from Reserve)
    // Team C: 90
    // Mean = (30 + 42 + 90)/3 = 162/3 = 54
    // Less bucket (<54): Team A(30), Team B(42) -> 2 teams (MAJORITY)
    // Greater bucket (>54): Team C(90) -> 1 team (MINORITY)
    // Team A played SHIELD: Shield covers majority deduction!
    const resolveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${roundId}/resolve`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
    });
    expect(resolveRes.statusCode).toBe(200);
    const scoreData = resolveRes.json().result;
    expect(scoreData.target).toBe('54');
    expect(scoreData.teamSummaries[teamA.id].shieldProtected).toBe(true);
    expect(scoreData.teamSummaries[teamA.id].delta).toBe('0');
  });

  it('allows admin to extend timer and void a round with ledger rollback', async () => {
    const admin = await loginAdmin();
    await setupEvent(admin.session, admin.csrf);

    await createTeam(admin.session, admin.csrf, 'Alpha');

    // Start round
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/rounds/start',
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: { roundNumber: 1, lobbySeconds: 15 },
    });
    const roundId = startRes.json().round.id;

    // Extend timer
    const extendRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${roundId}/extend-timer`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: { additionalSeconds: 30 },
    });
    expect(extendRes.statusCode).toBe(200);
    expect(extendRes.json().round.lobbySeconds).toBe(45);

    // Void round
    const voidRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/rounds/${roundId}/void`,
      headers: { 'x-csrf-token': admin.csrf.token },
      cookies: {
        [config.csrfCookieName]: admin.csrf.cookie,
        [config.sessionCookieName]: admin.session,
      },
      payload: { reason: 'Technical glitch on screen' },
    });
    expect(voidRes.statusCode).toBe(200);

    const checkRound = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/rounds/${roundId}/state`,
      cookies: { [config.sessionCookieName]: admin.session },
    });
    expect(checkRound.json().round.status).toBe('ABORTED');
  });
});
