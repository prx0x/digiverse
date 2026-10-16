import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { badRequest, forbidden } from '../lib/errors.js';
import { assertCsrf, requireRole } from '../plugins/auth.js';
import {
  advanceRoundToSelection,
  extendRoundTimer,
  getAdminRoundState,
  getLeaderboard,
  getTeamRoundView,
  playRoundCard,
  resolveAndScoreRound,
  startRound,
  submitPick,
  voidRound,
} from '../services/gameRoundService.js';
import { getActiveEvent } from '../services/rapidFireService.js';

const startRoundSchema = z.object({
  roundNumber: z.number().int().min(1).optional(),
  statCard: z
    .enum([
      'MEAN',
      'TWO_THIRDS',
      'MIDRANGE',
      'MEAN_PLUS_SIGMA',
      'GEOMETRIC_MEAN',
    ])
    .optional(),
  lobbySeconds: z.number().int().min(5).max(300).optional(),
  selectionSeconds: z.number().int().min(10).max(600).optional(),
  isPractice: z.boolean().optional(),
  scoreMultiplier: z.number().int().min(1).max(10).optional(),
});

const extendTimerSchema = z.object({
  additionalSeconds: z.number().int().min(5).max(300),
});

const voidRoundSchema = z.object({
  reason: z.string().min(1).max(256),
});

const submitPickSchema = z.object({
  pick: z.number().int().min(1).max(100),
});

const playCardSchema = z.object({
  cardType: z.enum(['SHIELD', 'RESERVE', 'PEEK', 'REVERSE']),
  reservedNumber: z.number().int().min(1).max(100).optional(),
});

export const gameRoundRoutes: FastifyPluginAsync = async (app) => {
  // --- Admin Routes ---

  // Admin: Start round (enters LOBBY)
  app.post('/admin/rounds/start', async (request) => {
    await requireRole(request, 'admin');
    assertCsrf(request);

    const parsed = startRoundSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw badRequest('Invalid parameters', parsed.error.flatten());
    }

    const evt = await getActiveEvent(app.db);
    const round = await startRound(app.db, {
      eventId: evt.id,
      ...parsed.data,
    });

    const state = await getAdminRoundState(app.db, round.id);
    return { round, state };
  });

  // Admin: Open selection
  app.post<{ Params: { id: string } }>('/admin/rounds/:id/open-selection', async (request) => {
    await requireRole(request, 'admin');
    assertCsrf(request);

    const round = await advanceRoundToSelection(app.db, request.params.id);
    const state = await getAdminRoundState(app.db, round.id);
    return { round, state };
  });

  // Admin: Resolve and score round
  app.post<{ Params: { id: string } }>('/admin/rounds/:id/resolve', async (request) => {
    await requireRole(request, 'admin');
    assertCsrf(request);

    const result = await resolveAndScoreRound(app.db, request.params.id);
    const state = await getAdminRoundState(app.db, request.params.id);
    return { result, state };
  });

  // Admin: Extend timer
  app.post<{ Params: { id: string } }>('/admin/rounds/:id/extend-timer', async (request) => {
    const user = await requireRole(request, 'admin');
    assertCsrf(request);

    const parsed = extendTimerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest('Invalid parameters', parsed.error.flatten());
    }

    const round = await extendRoundTimer(app.db, {
      roundId: request.params.id,
      additionalSeconds: parsed.data.additionalSeconds,
      adminUserId: user.id,
    });

    return { round };
  });

  // Admin: Void round
  app.post<{ Params: { id: string } }>('/admin/rounds/:id/void', async (request) => {
    const user = await requireRole(request, 'admin');
    assertCsrf(request);

    const parsed = voidRoundSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest('Invalid parameters', parsed.error.flatten());
    }

    await voidRound(app.db, {
      roundId: request.params.id,
      reason: parsed.data.reason,
      adminUserId: user.id,
    });

    return { success: true };
  });

  // Admin: Live round state
  app.get('/admin/rounds/current', async (request) => {
    await requireRole(request, 'admin');
    return await getAdminRoundState(app.db);
  });

  app.get<{ Params: { id: string } }>('/admin/rounds/:id/state', async (request) => {
    await requireRole(request, 'admin');
    return await getAdminRoundState(app.db, request.params.id);
  });

  // Leaderboard (both admin and teams)
  app.get('/leaderboard', async () => {
    const evt = await getActiveEvent(app.db);
    const leaderboard = await getLeaderboard(app.db, evt.id);
    return { leaderboard };
  });

  app.get('/admin/leaderboard', async (request) => {
    await requireRole(request, 'admin');
    const evt = await getActiveEvent(app.db);
    const leaderboard = await getLeaderboard(app.db, evt.id);
    return { leaderboard };
  });

  // --- Team Routes ---

  // Team: View active round
  app.get('/rounds/current', async (request) => {
    const user = await requireRole(request, 'team');
    if (!user.team) throw forbidden('Team profile missing');

    return await getTeamRoundView(app.db, { teamId: user.team.id });
  });

  app.get<{ Params: { id: string } }>('/rounds/:id', async (request) => {
    const user = await requireRole(request, 'team');
    if (!user.team) throw forbidden('Team profile missing');

    return await getTeamRoundView(app.db, {
      roundId: request.params.id,
      teamId: user.team.id,
    });
  });

  // Team: Submit pick
  app.post('/rounds/current/pick', async (request) => {
    const user = await requireRole(request, 'team');
    if (!user.team) throw forbidden('Team profile missing');
    assertCsrf(request);

    const parsed = submitPickSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest('Invalid pick', parsed.error.flatten());
    }

    const currentView = await getTeamRoundView(app.db, { teamId: user.team.id });
    if (!currentView.active || !currentView.round) {
      throw badRequest('No active round');
    }

    const pick = await submitPick(app.db, {
      roundId: currentView.round.id,
      teamId: user.team.id,
      pick: parsed.data.pick,
    });

    return { success: true, pick };
  });

  // Team: Play card
  app.post('/rounds/current/cards/play', async (request) => {
    const user = await requireRole(request, 'team');
    if (!user.team) throw forbidden('Team profile missing');
    assertCsrf(request);

    const parsed = playCardSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest('Invalid card play parameters', parsed.error.flatten());
    }

    const currentView = await getTeamRoundView(app.db, { teamId: user.team.id });
    if (!currentView.active || !currentView.round) {
      throw badRequest('No active round');
    }

    const result = await playRoundCard(app.db, {
      roundId: currentView.round.id,
      teamId: user.team.id,
      cardType: parsed.data.cardType,
      reservedNumber: parsed.data.reservedNumber,
    });

    return { success: true, ...result };
  });
};
