import type { FastifyPluginAsync } from 'fastify';
import { forbidden } from '../lib/errors.js';
import { requireRole } from '../plugins/auth.js';
import { getActiveEvent, getTeamInventory } from '../services/rapidFireService.js';

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/teams/me', async (request) => {
    const user = await requireRole(request, 'team');
    if (!user.team) throw forbidden('Team profile missing');

    const evt = await getActiveEvent(app.db);
    const cards = await getTeamInventory(app.db, {
      eventId: evt.id,
      teamId: user.team.id,
    });

    // Group cards by type for summary
    const countMap = new Map<string, number>();
    for (const c of cards) {
      countMap.set(c.cardType, (countMap.get(c.cardType) ?? 0) + 1);
    }
    const inventorySummary = {
      cards: Array.from(countMap.entries()).map(([card, count]) => ({ card, count })),
    };

    return {
      team: {
        id: user.team.id,
        name: user.team.name,
        tag: user.team.tag,
        identifier: user.identifier,
      },
      inventorySummary,
    };
  });

  app.get('/teams/me/cards', async (request) => {
    const user = await requireRole(request, 'team');
    if (!user.team) throw forbidden('Team profile missing');

    const evt = await getActiveEvent(app.db);
    const cards = await getTeamInventory(app.db, {
      eventId: evt.id,
      teamId: user.team.id,
    });

    return { cards };
  });
};
