import type { FastifyPluginAsync } from 'fastify';
import { forbidden } from '../lib/errors.js';
import { requireRole } from '../plugins/auth.js';

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/teams/me', async (request) => {
    const user = await requireRole(request, 'team');
    if (!user.team) throw forbidden('Team profile missing');
    return {
      team: {
        id: user.team.id,
        name: user.team.name,
        tag: user.team.tag,
        identifier: user.identifier,
      },
      // Inventory arrives in Build Phase 4
      inventorySummary: { cards: [] as { card: string; count: number }[] },
    };
  });
};
