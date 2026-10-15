import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { bootstrapAdmin } from './services/bootstrap.js';

describe('API & Authentication Flow', () => {
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

  async function getCsrf() {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const cookie = res.cookies.find((c) => c.name === config.csrfCookieName)?.value;
    return { token: body.csrfToken as string, cookie: cookie as string };
  }

  it('GET /health returns 200 ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', app: config.APP_NAME });
  });

  it('rejects POST /api/v1/auth/login without CSRF token (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: config.ADMIN_BOOTSTRAP_USER_ID,
        password: config.ADMIN_BOOTSTRAP_PASSWORD,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CSRF_FAILED');
  });

  it('rejects POST /api/v1/auth/login with wrong credentials (401)', async () => {
    const csrf = await getCsrf();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        'x-csrf-token': csrf.token,
      },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
      },
      payload: {
        identifier: config.ADMIN_BOOTSTRAP_USER_ID,
        password: 'DefinatelyWrongPassword!',
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('authenticates admin with bootstrapped credentials and sets session cookie', async () => {
    const csrf = await getCsrf();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        'x-csrf-token': csrf.token,
      },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
      },
      payload: {
        identifier: config.ADMIN_BOOTSTRAP_USER_ID,
        password: config.ADMIN_BOOTSTRAP_PASSWORD,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.role).toBe('admin');
    expect(body.user.identifier).toBe(config.ADMIN_BOOTSTRAP_USER_ID);

    const sessionCookie = res.cookies.find((c) => c.name === config.sessionCookieName);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
    expect(sessionCookie?.httpOnly).toBe(true);

    // Verify /api/v1/auth/me works with this session
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: {
        [config.sessionCookieName]: sessionCookie!.value,
      },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().user.role).toBe('admin');
  });

  it('enforces RBAC: team accounts and admin endpoints', async () => {
    const csrf = await getCsrf();

    // 1. Log in as admin
    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-csrf-token': csrf.token },
      cookies: { [config.csrfCookieName]: csrf.cookie },
      payload: {
        identifier: config.ADMIN_BOOTSTRAP_USER_ID,
        password: config.ADMIN_BOOTSTRAP_PASSWORD,
      },
    });
    const adminSession = adminLoginRes.cookies.find((c) => c.name === config.sessionCookieName)!.value;

    // 2. Admin creates a new team
    const testIdentifier = `team_test_${Date.now()}`;
    const testPassword = 'Password123!Secure';
    const createTeamRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/teams',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: {
        identifier: testIdentifier,
        password: testPassword,
        name: 'Alpha Squad',
        tag: 'ALPHA',
      },
    });
    expect(createTeamRes.statusCode).toBe(200);
    const createdTeam = createTeamRes.json().team;
    expect(createdTeam.name).toBe('Alpha Squad');
    expect(createdTeam.identifier).toBe(testIdentifier);

    // 3. Admin lists teams
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/teams',
      cookies: { [config.sessionCookieName]: adminSession },
    });
    expect(listRes.statusCode).toBe(200);
    const teamList = listRes.json().teams;
    expect(teamList.some((t: { id: string }) => t.id === createdTeam.id)).toBe(true);

    // 4. Team logs in
    const teamLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-csrf-token': csrf.token },
      cookies: { [config.csrfCookieName]: csrf.cookie },
      payload: {
        identifier: testIdentifier,
        password: testPassword,
      },
    });
    expect(teamLoginRes.statusCode).toBe(200);
    expect(teamLoginRes.json().user.role).toBe('team');
    const teamSession = teamLoginRes.cookies.find((c) => c.name === config.sessionCookieName)!.value;

    // 5. Team can access /api/v1/teams/me
    const teamMeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/teams/me',
      cookies: { [config.sessionCookieName]: teamSession },
    });
    expect(teamMeRes.statusCode).toBe(200);
    expect(teamMeRes.json().team.name).toBe('Alpha Squad');

    // 6. Team cannot access admin route (403 Forbidden)
    const teamAdminRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/teams',
      cookies: { [config.sessionCookieName]: teamSession },
    });
    expect(teamAdminRes.statusCode).toBe(403);
    expect(teamAdminRes.json().error.code).toBe('FORBIDDEN');

    // 7. Admin disables team
    const disableRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/teams/${createdTeam.id}/disable`,
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
    });
    expect(disableRes.statusCode).toBe(200);
    expect(disableRes.json().team.enabled).toBe(false);

    // 8. Disabled team cannot log in (401 Unauthorized)
    const disabledLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-csrf-token': csrf.token },
      cookies: { [config.csrfCookieName]: csrf.cookie },
      payload: {
        identifier: testIdentifier,
        password: testPassword,
      },
    });
    expect(disabledLoginRes.statusCode).toBe(401);

    // 9. Admin resets password and re-enables team
    const newPassword = 'NewPassword456!Secure';
    const resetRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/teams/${createdTeam.id}/reset-password`,
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
      payload: { password: newPassword },
    });
    expect(resetRes.statusCode).toBe(200);

    const enableRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/teams/${createdTeam.id}/enable`,
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: adminSession,
      },
    });
    expect(enableRes.statusCode).toBe(200);
    expect(enableRes.json().team.enabled).toBe(true);

    // 10. Team logs in with new password
    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-csrf-token': csrf.token },
      cookies: { [config.csrfCookieName]: csrf.cookie },
      payload: {
        identifier: testIdentifier,
        password: newPassword,
      },
    });
    expect(newLoginRes.statusCode).toBe(200);
    const newTeamSession = newLoginRes.cookies.find((c) => c.name === config.sessionCookieName)!.value;

    // 11. Team logs out
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { 'x-csrf-token': csrf.token },
      cookies: {
        [config.csrfCookieName]: csrf.cookie,
        [config.sessionCookieName]: newTeamSession,
      },
    });
    expect(logoutRes.statusCode).toBe(200);

    // 12. Revoked session is rejected
    const afterLogoutMe = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { [config.sessionCookieName]: newTeamSession },
    });
    expect(afterLogoutMe.statusCode).toBe(401);
  });

  it('triggers rate limiting on repeated failed login attempts', async () => {
    const csrf = await getCsrf();
    let lastStatus = 0;
    // RATE_LIMIT_LOGIN_MAX is 10 by default
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-csrf-token': csrf.token },
        cookies: { [config.csrfCookieName]: csrf.cookie },
        payload: {
          identifier: 'nonexistent-user',
          password: 'bad-password',
        },
      });
      lastStatus = res.statusCode;
      if (res.statusCode === 429) {
        expect(res.json().error.code).toBe('RATE_LIMITED');
        break;
      }
    }
    expect(lastStatus).toBe(429);
  });
});
