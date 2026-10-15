import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { bootstrapAdmin } from './services/bootstrap.js';

describe('Build Phase 3 — admin event configuration', () => {
  let app: FastifyInstance;
  let sqlClient: ReturnType<typeof postgres>;
  const config = loadConfig();

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

  async function loginTeam() {
    const { csrf, session: adminSession } = await loginAdmin();
    const identifier = `phase3_team_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const password = 'Password123!Secure';
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/teams',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { identifier, password, name: 'Config Team' },
    });
    const teamLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-csrf-token': csrf.token },
      cookies: { [config.csrfCookieName]: csrf.cookie },
      payload: { identifier, password },
    });
    const teamSession = teamLogin.cookies.find((c) => c.name === config.sessionCookieName)!.value;
    return { csrf, teamSession };
  }

  it('creates a DRAFT event on first GET and forbids team access', async () => {
    const { csrf, session } = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/event',
      cookies: { [config.sessionCookieName]: session },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.event.status).toBe('DRAFT');
    expect(body.cardSupply.find((c: { cardType: string }) => c.cardType === 'RESERVE').maxSupply).toBe(
      1,
    );
    expect(body.readiness.canMarkReady).toBe(false);

    const { teamSession } = await loginTeam();
    const teamRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/event',
      cookies: { [config.sessionCookieName]: teamSession },
    });
    expect(teamRes.statusCode).toBe(403);
    expect(teamRes.json().error.code).toBe('FORBIDDEN');

    const teamPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/event/rules',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: teamSession,
      },
      payload: { clashPenaltyMode: 'FIXED_X' },
    });
    expect(teamPut.statusCode).toBe(403);
  });

  it('rejects invalid configs: second Reserve, unknown stat card, top-N < 1, round count < 1', async () => {
    const { csrf, session } = await loginAdmin();
    const cookies = {
      [config.csrfCookieName]: csrf.cookie,
      [config.sessionCookieName]: session,
    };
    await app.inject({ method: 'GET', url: '/api/v1/admin/event', cookies: { [config.sessionCookieName]: session } });

    const supply = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/card-supply',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: {
        items: [
          { cardType: 'SHIELD', maxSupply: 1 },
          { cardType: 'RESERVE', maxSupply: 2 },
          { cardType: 'PEEK', maxSupply: 0 },
          { cardType: 'REVERSE', maxSupply: 0 },
        ],
      },
    });
    expect(supply.statusCode).toBe(400);

    const rounds = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/event',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { gamePhaseARoundCount: 0 },
    });
    expect(rounds.statusCode).toBe(400);

    const unknownStat = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/rounds',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { rounds: [{ roundNumber: 1, statCard: 'MEDIAN', timerSeconds: 30 }] },
    });
    expect(unknownStat.statusCode).toBe(400);

    const setRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/question-sets',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { name: 'Set A' },
    });
    expect(setRes.statusCode).toBe(200);
    const setId = setRes.json().questionSets[0].id;

    const topN = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/question-sets/${setId}/questions`,
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: {
        prompt: 'What is 2+2?',
        answerDefinition: '4',
        matchingMode: 'EXACT',
        timeLimitSeconds: 20,
        mappedCard: 'SHIELD',
        topN: 0,
      },
    });
    expect(topN.statusCode).toBe(400);
  });

  it('persists questions, mappings, rounds, rules across reads', async () => {
    const { csrf, session } = await loginAdmin();
    const cookies = {
      [config.csrfCookieName]: csrf.cookie,
      [config.sessionCookieName]: session,
    };
    await app.inject({ method: 'GET', url: '/api/v1/admin/event', cookies: { [config.sessionCookieName]: session } });

    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/card-supply',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: {
        items: [
          { cardType: 'SHIELD', maxSupply: 2 },
          { cardType: 'RESERVE', maxSupply: 1 },
          { cardType: 'PEEK', maxSupply: 2 },
          { cardType: 'REVERSE', maxSupply: 1 },
        ],
      },
    });

    const setRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/question-sets',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { name: 'Warm-up' },
    });
    const setId = setRes.json().questionSets[0].id as string;

    const qRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/question-sets/${setId}/questions`,
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: {
        prompt: 'Only even prime?',
        answerDefinition: '2',
        matchingMode: 'NORMALIZED',
        timeLimitSeconds: 25,
        mappedCard: 'RESERVE',
        topN: 1,
      },
    });
    expect(qRes.statusCode).toBe(200);

    const secondReserve = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/question-sets/${setId}/questions`,
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: {
        prompt: 'Another reserve?',
        answerDefinition: 'no',
        matchingMode: 'EXACT',
        timeLimitSeconds: 10,
        mappedCard: 'RESERVE',
        topN: 1,
      },
    });
    expect(secondReserve.statusCode).toBe(400);

    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/event',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: {
        name: 'GDGoC Night',
        gamePhaseARoundCount: 3,
        gamePhaseBRoundCount: 2,
        roundSelectionSeconds: 45,
      },
    });

    const roundsRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/rounds',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: {
        rounds: [
          { roundNumber: 1, statCard: 'MEAN', timerSeconds: 45 },
          { roundNumber: 2, statCard: 'GEOMETRIC_MEAN', timerSeconds: 50 },
        ],
      },
    });
    expect(roundsRes.statusCode).toBe(200);

    const rulesRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/event/rules',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: {
        clashPenaltyMode: 'FIXED_X',
        clashPenaltyX: '10',
        majorityPenaltyMode: 'HALF_ABS_DISTANCE',
      },
    });
    expect(rulesRes.statusCode).toBe(200);

    const reread = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/event',
      cookies: { [config.sessionCookieName]: session },
    });
    const body = reread.json();
    expect(body.event.name).toBe('GDGoC Night');
    expect(body.event.gamePhaseARoundCount).toBe(3);
    expect(body.event.gamePhaseBRoundCount).toBe(2);
    expect(body.rounds).toHaveLength(2);
    expect(body.rounds[1].statCard).toBe('GEOMETRIC_MEAN');
    expect(body.questionSets[0].questions[0].mappedCard).toBe('RESERVE');
    expect(body.rules.clashPenaltyMode).toBe('FIXED_X');
    expect(body.rules.clashPenaltyX).toBe('10.0000000000');
  });

  it('locks config at READY/LIVE except organiser X while LIVE', async () => {
    const { csrf, session } = await loginAdmin();
    const cookies = {
      [config.csrfCookieName]: csrf.cookie,
      [config.sessionCookieName]: session,
    };

    await app.inject({ method: 'GET', url: '/api/v1/admin/event', cookies: { [config.sessionCookieName]: session } });

    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/card-supply',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: {
        items: [
          { cardType: 'SHIELD', maxSupply: 1 },
          { cardType: 'RESERVE', maxSupply: 1 },
          { cardType: 'PEEK', maxSupply: 0 },
          { cardType: 'REVERSE', maxSupply: 0 },
        ],
      },
    });

    const setRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/question-sets',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { name: 'Set 1' },
    });
    const setId = setRes.json().questionSets[0].id as string;
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/question-sets/${setId}/questions`,
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: {
        prompt: 'Q1',
        answerDefinition: 'A1',
        matchingMode: 'EXACT',
        timeLimitSeconds: 15,
        mappedCard: 'SHIELD',
        topN: 1,
      },
    });
    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/rounds',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { rounds: [{ roundNumber: 1, statCard: 'MEAN', timerSeconds: 60 }] },
    });

    const notReady = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/event/lifecycle',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { status: 'LIVE' },
    });
    expect(notReady.statusCode).toBe(409);

    const ready = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/event/lifecycle',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { status: 'READY' },
    });
    expect(ready.statusCode).toBe(200);
    expect(ready.json().event.status).toBe('READY');

    const lockedEdit = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/event',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { name: 'Hacked' },
    });
    expect(lockedEdit.statusCode).toBe(409);
    expect(lockedEdit.json().error.code).toBe('CONFIG_LOCKED');

    const live = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/event/lifecycle',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { status: 'LIVE' },
    });
    expect(live.statusCode).toBe(200);

    const forbiddenLive = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/event/rules',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { clashPenaltyMode: 'TWO_THIRDS_OF_PICK' },
    });
    expect(forbiddenLive.statusCode).toBe(409);

    const allowedX = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/event/rules',
      headers: { 'x-csrf-token': csrf.token },
      cookies,
      payload: { clashPenaltyX: '7.5' },
    });
    expect(allowedX.statusCode).toBe(200);
    expect(allowedX.json().rules.clashPenaltyX).toBe('7.5000000000');
  });
});
