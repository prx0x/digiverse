import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  CLASH_PENALTY_MODES,
  DEGENERATE_ROUND_MODES,
  DISPLAY_ROUNDING_MODES,
  EQUALITY_MODES,
  EVENT_STATUSES,
  MAJORITY_PENALTY_MODES,
  MATCHING_MODES,
  NO_PICK_BEHAVIOURS,
  POWER_UP_CARDS,
  RAPID_FIRE_TIE_BREAKS,
  REVERSED_MAJORITY_REWARDS,
  SAMPLE_STDDEV_SINGLE_BEHAVIOURS,
  STAT_CARDS,
  STD_DEV_MODES,
} from '@digiverse/shared';
import { badRequest } from '../lib/errors.js';
import { assertCsrf, requireRole } from '../plugins/auth.js';
import {
  createQuestion,
  createQuestionSet,
  deleteQuestion,
  deleteQuestionSet,
  getEventBundle,
  transitionEvent,
  updateCardSupply,
  updateEventSettings,
  updatePhaseBRounds,
  updateQuestion,
  updateQuestionSet,
  updateRules,
} from '../services/eventConfig.js';

const optionalNullableString = z.string().nullable().optional();
const optionalNullableBool = z.boolean().nullable().optional();
const optionalNullableInt = z.number().int().nullable().optional();

const eventSettingsSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  gamePhaseARoundCount: z.number().int().min(1).optional(),
  gamePhaseBRoundCount: z.number().int().min(1).optional(),
  rapidFireDefaultTimeLimitSeconds: z.number().int().min(1).optional(),
  roundSelectionSeconds: z.number().int().min(1).optional(),
  statCardAnnouncementSeconds: z.number().int().min(0).optional(),
});

const lifecycleSchema = z.object({
  status: z.enum(EVENT_STATUSES),
});

const rulesSchema = z.object({
  clashPenaltyMode: z.enum(CLASH_PENALTY_MODES).nullable().optional(),
  clashPenaltyX: optionalNullableString,
  majorityPenaltyMode: z.enum(MAJORITY_PENALTY_MODES).nullable().optional(),
  majorityPenaltyX: optionalNullableString,
  reversedMajorityReward: z.enum(REVERSED_MAJORITY_REWARDS).nullable().optional(),
  reverseAffectsEqualTo: optionalNullableBool,
  reverseAffectsTiebreaker: optionalNullableBool,
  reverseIsGlobal: optionalNullableBool,
  shieldCoversClash: optionalNullableBool,
  shieldCoversMajority: optionalNullableBool,
  shieldCoversReversedMinority: optionalNullableBool,
  shieldConsumedOnPlay: optionalNullableBool,
  stdDevMode: z.enum(STD_DEV_MODES).nullable().optional(),
  sampleStdDevForSingleValue: z.enum(SAMPLE_STDDEV_SINGLE_BEHAVIOURS).nullable().optional(),
  degenerateRoundMode: z.enum(DEGENERATE_ROUND_MODES).nullable().optional(),
  equalityMode: z.enum(EQUALITY_MODES).nullable().optional(),
  equalityEpsilon: optionalNullableString,
  displayRounding: z.enum(DISPLAY_ROUNDING_MODES).nullable().optional(),
  maxCardsPlayedPerRoundPerTeam: optionalNullableInt,
  allowMultipleReversePerTeam: optionalNullableBool,
  unusedCardsCarryForward: optionalNullableBool,
  cardsConsumedEvenIfNoEffect: optionalNullableBool,
  noPickBehaviour: z.enum(NO_PICK_BEHAVIOURS).nullable().optional(),
  allowPickChangeBeforeLock: optionalNullableBool,
  preRoundCardsLobbyOnly: optionalNullableBool,
  rapidFireTieBreak: z.enum(RAPID_FIRE_TIE_BREAKS).nullable().optional(),
  rapidFireMaxAttempts: optionalNullableInt,
});

const supplySchema = z.object({
  items: z.array(
    z.object({
      cardType: z.enum(POWER_UP_CARDS),
      maxSupply: z.number().int().min(0),
    }),
  ),
});

const roundsSchema = z.object({
  rounds: z.array(
    z.object({
      roundNumber: z.number().int().min(1),
      statCard: z.enum(STAT_CARDS).nullable(),
      timerSeconds: z.number().int().min(1),
    }),
  ),
});

const questionSetSchema = z.object({
  name: z.string().min(1).max(128),
  orderIndex: z.number().int().min(1).optional(),
});

const questionSchema = z.object({
  prompt: z.string().min(1),
  answerDefinition: z.string().min(1),
  matchingMode: z.enum(MATCHING_MODES),
  timeLimitSeconds: z.number().int().min(1),
  mappedCard: z.enum(POWER_UP_CARDS).nullable(),
  topN: z.number().int().min(1),
});

const questionPatchSchema = questionSchema.partial();

const idParams = z.object({ id: z.string().uuid() });
const setIdParams = z.object({ setId: z.string().uuid() });

export const adminEventRoutes: FastifyPluginAsync = async (app) => {
  const actionLimit = {
    config: {
      rateLimit: {
        max: app.config.RATE_LIMIT_ACTIONS_MAX,
        timeWindow: app.config.RATE_LIMIT_ACTIONS_WINDOW_SEC * 1000,
      },
    },
  };

  app.get('/admin/event', async (request) => {
    await requireRole(request, 'admin');
    return getEventBundle(app.db);
  });

  app.put('/admin/event', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const parsed = eventSettingsSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest('Invalid event settings', parsed.error.flatten());
    return updateEventSettings(app.db, parsed.data);
  });

  app.post('/admin/event/lifecycle', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const parsed = lifecycleSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest('Invalid lifecycle payload', parsed.error.flatten());
    return transitionEvent(app.db, parsed.data.status);
  });

  app.get('/admin/event/rules', async (request) => {
    await requireRole(request, 'admin');
    const bundle = await getEventBundle(app.db);
    return { rules: bundle.rules, readiness: bundle.readiness };
  });

  app.put('/admin/event/rules', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const parsed = rulesSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest('Invalid rules payload', parsed.error.flatten());
    return updateRules(app.db, parsed.data);
  });

  app.get('/admin/card-supply', async (request) => {
    await requireRole(request, 'admin');
    const bundle = await getEventBundle(app.db);
    return { cardSupply: bundle.cardSupply, readiness: bundle.readiness };
  });

  app.put('/admin/card-supply', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const parsed = supplySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest('Invalid card supply payload', parsed.error.flatten());
    return updateCardSupply(app.db, parsed.data.items);
  });

  app.put('/admin/rounds', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const parsed = roundsSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest('Invalid rounds payload', parsed.error.flatten());
    return updatePhaseBRounds(app.db, parsed.data.rounds);
  });

  app.post('/admin/question-sets', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const parsed = questionSetSchema.pick({ name: true }).safeParse(request.body);
    if (!parsed.success) throw badRequest('Invalid question set payload', parsed.error.flatten());
    return createQuestionSet(app.db, parsed.data.name);
  });

  app.patch('/admin/question-sets/:id', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const params = idParams.safeParse(request.params);
    const body = questionSetSchema.partial().safeParse(request.body);
    if (!params.success || !body.success) throw badRequest('Invalid question set update');
    return updateQuestionSet(app.db, params.data.id, body.data);
  });

  app.delete('/admin/question-sets/:id', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const params = idParams.safeParse(request.params);
    if (!params.success) throw badRequest('Invalid question set id');
    return deleteQuestionSet(app.db, params.data.id);
  });

  app.post('/admin/question-sets/:setId/questions', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const params = setIdParams.safeParse(request.params);
    const body = questionSchema.safeParse(request.body);
    if (!params.success || !body.success) throw badRequest('Invalid question payload');
    return createQuestion(app.db, params.data.setId, body.data);
  });

  app.patch('/admin/questions/:id', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const params = idParams.safeParse(request.params);
    const body = questionPatchSchema.safeParse(request.body);
    if (!params.success || !body.success) throw badRequest('Invalid question update');
    return updateQuestion(app.db, params.data.id, body.data);
  });

  app.delete('/admin/questions/:id', actionLimit, async (request) => {
    assertCsrf(request);
    await requireRole(request, 'admin');
    const params = idParams.safeParse(request.params);
    if (!params.success) throw badRequest('Invalid question id');
    return deleteQuestion(app.db, params.data.id);
  });
};
