import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { badRequest, forbidden } from '../lib/errors.js';
import { assertCsrf, requireRole } from '../plugins/auth.js';
import {
  awardRapidFireQuestion,
  closeRapidFireQuestion,
  getActiveEvent,
  getRapidFireAdminState,
  getRapidFireTeamView,
  startRapidFireQuestion,
  submitRapidFireAnswer,
} from '../services/rapidFireService.js';

const startQuestionSchema = z.object({
  questionId: z.string().uuid(),
});

const closeQuestionSchema = z.object({
  sessionId: z.string().uuid().optional(),
});

const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string().min(1, 'Answer is required').max(256, 'Answer too long'),
});

export const rapidFireRoutes: FastifyPluginAsync = async (app) => {
  // Admin: start question
  app.post('/admin/rapid-fire/start', async (request) => {
    await requireRole(request, 'admin');
    assertCsrf(request);

    const parsed = startQuestionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest('Invalid question ID', parsed.error.flatten());
    }

    const evt = await getActiveEvent(app.db);
    const session = await startRapidFireQuestion(app.db, {
      eventId: evt.id,
      questionId: parsed.data.questionId,
    });

    const state = await getRapidFireAdminState(app.db, evt.id);
    return { session, state };
  });

  // Admin: close question
  app.post('/admin/rapid-fire/close', async (request) => {
    await requireRole(request, 'admin');
    assertCsrf(request);

    const parsed = closeQuestionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw badRequest('Invalid parameters', parsed.error.flatten());
    }

    const evt = await getActiveEvent(app.db);
    const session = await closeRapidFireQuestion(app.db, {
      eventId: evt.id,
      sessionId: parsed.data.sessionId,
    });

    const state = await getRapidFireAdminState(app.db, evt.id);
    return { session, state };
  });

  // Admin: award question
  app.post('/admin/rapid-fire/award', async (request) => {
    await requireRole(request, 'admin');
    assertCsrf(request);

    const parsed = closeQuestionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw badRequest('Invalid parameters', parsed.error.flatten());
    }

    const evt = await getActiveEvent(app.db);
    const awards = await awardRapidFireQuestion(app.db, {
      eventId: evt.id,
      sessionId: parsed.data.sessionId,
    });

    const state = await getRapidFireAdminState(app.db, evt.id);
    return { awards, state };
  });

  // Admin: view current rapid fire state
  app.get('/admin/rapid-fire/state', async (request) => {
    await requireRole(request, 'admin');
    const evt = await getActiveEvent(app.db);
    return await getRapidFireAdminState(app.db, evt.id);
  });

  // Team: get current rapid fire view
  app.get('/rapid-fire/current', async (request) => {
    const user = await requireRole(request, 'team');
    if (!user.team) throw forbidden('Team profile missing');

    const evt = await getActiveEvent(app.db);
    return await getRapidFireTeamView(app.db, {
      eventId: evt.id,
      teamId: user.team.id,
    });
  });

  // Team: submit answer
  app.post(
    '/rapid-fire/answers',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '60 seconds',
        },
      },
    },
    async (request) => {
      const user = await requireRole(request, 'team');
      if (!user.team) throw forbidden('Team profile missing');
      assertCsrf(request);

      const parsed = submitAnswerSchema.safeParse(request.body);
      if (!parsed.success) {
        throw badRequest('Invalid submission format', parsed.error.flatten());
      }

      const evt = await getActiveEvent(app.db);
      return await submitRapidFireAnswer(app.db, {
        teamId: user.team.id,
        eventId: evt.id,
        questionId: parsed.data.questionId,
        rawAnswer: parsed.data.answer,
      });
    },
  );
};
