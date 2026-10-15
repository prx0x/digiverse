import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { badRequest, unauthorized } from '../lib/errors.js';
import { verifyPassword } from '../lib/password.js';
import {
  assertCsrf,
  clearSessionCookie,
  ensureCsrfCookie,
  requireAuth,
  setSessionCookie,
} from '../plugins/auth.js';
import {
  createSession,
  findUserByIdentifier,
  revokeSession,
  toAuthUser,
} from '../services/sessions.js';

const loginBodySchema = z.object({
  identifier: z.string().min(1).max(128),
  password: z.string().min(1).max(256),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/auth/csrf', async (request, reply) => {
    const token = ensureCsrfCookie(request, reply);
    return { csrfToken: token };
  });

  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: app.config.RATE_LIMIT_LOGIN_MAX,
          timeWindow: app.config.RATE_LIMIT_LOGIN_WINDOW_SEC * 1000,
        },
      },
    },
    async (request, reply) => {
      assertCsrf(request);
      ensureCsrfCookie(request, reply);

      const parsed = loginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw badRequest('Invalid login payload', parsed.error.flatten());
      }

      const user = await findUserByIdentifier(app.db, parsed.data.identifier);
      // Generic failure message — do not reveal which field failed.
      const invalid = unauthorized('Invalid credentials');

      if (!user || !user.enabled) {
        // Still verify against a dummy path timing? argon2 on miss is enough delay if we hash.
        await verifyPassword(
          '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          parsed.data.password,
        ).catch(() => false);
        throw invalid;
      }

      const ok = await verifyPassword(user.passwordHash, parsed.data.password);
      if (!ok) throw invalid;

      const { token, expiresAt } = await createSession(app.db, app.config, user.id);
      setSessionCookie(reply, token, expiresAt);

      return {
        user: toAuthUser(user),
      };
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    assertCsrf(request);
    await requireAuth(request);
    if (request.sessionToken) {
      await revokeSession(app.db, request.sessionToken);
    }
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/auth/me', async (request, reply) => {
    ensureCsrfCookie(request, reply);
    const user = await requireAuth(request);
    return { user };
  });
};
