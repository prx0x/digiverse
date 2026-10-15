import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';
import { assertCsrf, requireRole } from '../plugins/auth.js';
import {
  createTeam,
  listTeams,
  resetTeamPassword,
  setTeamEnabled,
} from '../services/teams.js';

const createTeamSchema = z.object({
  identifier: z.string().min(1).max(128),
  password: z.string().min(8).max(256),
  name: z.string().min(1).max(128),
  tag: z.string().max(32).optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8).max(256),
});

const teamIdParams = z.object({
  id: z.string().uuid(),
});

export const adminTeamRoutes: FastifyPluginAsync = async (app) => {
  const actionLimit = {
    config: {
      rateLimit: {
        max: app.config.RATE_LIMIT_ACTIONS_MAX,
        timeWindow: app.config.RATE_LIMIT_ACTIONS_WINDOW_SEC * 1000,
      },
    },
  };

  app.get('/admin/teams', async (request) => {
    await requireRole(request, 'admin');
    const teams = await listTeams(app.db);
    return { teams };
  });

  app.post('/admin/teams', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const parsed = createTeamSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest('Invalid team payload', parsed.error.flatten());
    }
    const team = await createTeam(app.db, parsed.data);
    return { team };
  });

  app.post('/admin/teams/:id/reset-password', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const params = teamIdParams.safeParse(request.params);
    const body = resetPasswordSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      throw badRequest('Invalid reset-password payload');
    }
    const result = await resetTeamPassword(app.db, params.data.id, body.data.password);
    return result;
  });

  app.post('/admin/teams/:id/disable', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const params = teamIdParams.safeParse(request.params);
    if (!params.success) throw badRequest('Invalid team id');
    const team = await setTeamEnabled(app.db, params.data.id, false);
    return { team };
  });

  app.post('/admin/teams/:id/enable', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const params = teamIdParams.safeParse(request.params);
    if (!params.success) throw badRequest('Invalid team id');
    const team = await setTeamEnabled(app.db, params.data.id, true);
    return { team };
  });
};
