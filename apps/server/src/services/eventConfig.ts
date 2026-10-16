import { and, asc, eq } from 'drizzle-orm';
import {
  LIVE_EDITABLE_RULE_FIELDS,
  POWER_UP_CARDS,
  REQUIRED_RULE_FIELDS_FOR_GAME_PHASE_B,
  defaultCardSupply,
  isNonNegativeDecimalString,
  isPositiveInt,
  validateAwardedVsSupply,
  validateCardSupplyMap,
  type CardSupplyMap,
  type EventStatus,
  type LiveEditableRuleField,
  type MappedAward,
  type PowerUpCard,
  type StatCard,
} from '@digiverse/shared';
import type { Db } from '../db/client.js';
import {
  cardSupply,
  eventRules,
  events,
  questionSets,
  questions,
  roundConfigs,
  type Event,
  type EventRules,
} from '../db/schema.js';
import { badRequest, configLocked, conflict, notFound } from '../lib/errors.js';

export type Readiness = {
  canMarkReady: boolean;
  issues: string[];
  gamePhaseBRulesComplete: boolean;
  unsetRuleFields: string[];
};

const LIVE_EDITABLE = new Set<string>(LIVE_EDITABLE_RULE_FIELDS);

export function assertDraft(event: Event, extra = ''): void {
  if (event.status !== 'DRAFT') {
    throw configLocked(
      extra || `Configuration is locked while the event is ${event.status}. Return to DRAFT to edit.`,
    );
  }
}

function serializeEvent(event: Event) {
  return {
    id: event.id,
    name: event.name,
    status: event.status,
    gamePhaseARoundCount: event.gamePhaseARoundCount,
    gamePhaseBRoundCount: event.gamePhaseBRoundCount,
    rapidFireDefaultTimeLimitSeconds: event.rapidFireDefaultTimeLimitSeconds,
    roundSelectionSeconds: event.roundSelectionSeconds,
    statCardAnnouncementSeconds: event.statCardAnnouncementSeconds,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function serializeRules(rules: EventRules) {
  return {
    clashPenaltyMode: rules.clashPenaltyMode,
    clashPenaltyX: rules.clashPenaltyX,
    majorityPenaltyMode: rules.majorityPenaltyMode,
    majorityPenaltyX: rules.majorityPenaltyX,
    reversedMajorityReward: rules.reversedMajorityReward,
    reverseAffectsEqualTo: rules.reverseAffectsEqualTo,
    reverseAffectsTiebreaker: rules.reverseAffectsTiebreaker,
    reverseIsGlobal: rules.reverseIsGlobal,
    shieldCoversClash: rules.shieldCoversClash,
    shieldCoversMajority: rules.shieldCoversMajority,
    shieldCoversReversedMinority: rules.shieldCoversReversedMinority,
    shieldConsumedOnPlay: rules.shieldConsumedOnPlay,
    stdDevMode: rules.stdDevMode,
    sampleStdDevForSingleValue: rules.sampleStdDevForSingleValue,
    degenerateRoundMode: rules.degenerateRoundMode,
    equalityMode: rules.equalityMode,
    equalityEpsilon: rules.equalityEpsilon,
    displayRounding: rules.displayRounding,
    maxCardsPlayedPerRoundPerTeam: rules.maxCardsPlayedPerRoundPerTeam,
    allowMultipleReversePerTeam: rules.allowMultipleReversePerTeam,
    unusedCardsCarryForward: rules.unusedCardsCarryForward,
    cardsConsumedEvenIfNoEffect: rules.cardsConsumedEvenIfNoEffect,
    noPickBehaviour: rules.noPickBehaviour,
    allowPickChangeBeforeLock: rules.allowPickChangeBeforeLock,
    preRoundCardsLobbyOnly: rules.preRoundCardsLobbyOnly,
    rapidFireTieBreak: rules.rapidFireTieBreak,
    rapidFireMaxAttempts: rules.rapidFireMaxAttempts,
    updatedAt: rules.updatedAt.toISOString(),
  };
}

async function loadSupplyMap(db: Db, eventId: string): Promise<CardSupplyMap> {
  const rows = await db.query.cardSupply.findMany({
    where: eq(cardSupply.eventId, eventId),
  });
  const map = defaultCardSupply();
  for (const row of rows) {
    map[row.cardType] = row.maxSupply;
  }
  return map;
}

async function loadAwards(db: Db, eventId: string): Promise<MappedAward[]> {
  const sets = await db.query.questionSets.findMany({
    where: eq(questionSets.eventId, eventId),
    with: { questions: true },
  });
  return sets.flatMap((set) =>
    set.questions.map((q) => ({ card: q.mappedCard, topN: q.topN })),
  );
}

export async function computeReadiness(db: Db, event: Event): Promise<Readiness> {
  const issues: string[] = [];
  if (!event.name.trim()) issues.push('Event name is required');
  if (!isPositiveInt(event.gamePhaseARoundCount)) {
    issues.push('Game Phase A round count must be ≥ 1');
  }
  if (!isPositiveInt(event.gamePhaseBRoundCount)) {
    issues.push('Game Phase B round count must be ≥ 1');
  }
  if (!isPositiveInt(event.rapidFireDefaultTimeLimitSeconds)) {
    issues.push('Rapid-fire default time limit must be ≥ 1 second');
  }
  if (!isPositiveInt(event.roundSelectionSeconds)) {
    issues.push('Round selection timer must be ≥ 1 second');
  }
  if (event.statCardAnnouncementSeconds < 0) {
    issues.push('Stat-card announcement duration must be ≥ 0 seconds');
  }

  const phaseBRounds = await db.query.roundConfigs.findMany({
    where: and(eq(roundConfigs.eventId, event.id), eq(roundConfigs.gamePhase, 'B')),
    orderBy: [asc(roundConfigs.roundNumber)],
  });

  if (phaseBRounds.length !== event.gamePhaseBRoundCount) {
    issues.push(
      `Game Phase B has ${phaseBRounds.length} round records but count is ${event.gamePhaseBRoundCount}`,
    );
  }
  for (const round of phaseBRounds) {
    if (!round.statCard) {
      issues.push(`Game Phase B round ${round.roundNumber} has no stat card`);
    }
    if (!isPositiveInt(round.timerSeconds)) {
      issues.push(`Game Phase B round ${round.roundNumber} timer must be ≥ 1 second`);
    }
  }

  const sets = await db.query.questionSets.findMany({
    where: eq(questionSets.eventId, event.id),
    with: { questions: true },
    orderBy: [asc(questionSets.orderIndex)],
  });
  const allQuestions = sets.flatMap((s) => s.questions);
  if (sets.length < 1) issues.push('At least one question set is required');
  if (allQuestions.length < 1) issues.push('At least one question is required');
  for (const q of allQuestions) {
    if (!q.prompt.trim()) issues.push(`Question ${q.id} is missing text`);
    if (!q.answerDefinition.trim()) issues.push(`Question ${q.id} is missing an answer definition`);
    if (!isPositiveInt(q.timeLimitSeconds)) issues.push(`Question ${q.id} time limit must be ≥ 1`);
    if (!isPositiveInt(q.topN)) issues.push(`Question ${q.id} top-N must be ≥ 1`);
  }

  const supply = await loadSupplyMap(db, event.id);
  issues.push(
    ...validateAwardedVsSupply(
      allQuestions.map((q) => ({ card: q.mappedCard, topN: q.topN })),
      supply,
    ),
  );

  const rules = await db.query.eventRules.findFirst({
    where: eq(eventRules.eventId, event.id),
  });
  const unsetRuleFields: string[] = [];
  if (!rules) {
    unsetRuleFields.push(...REQUIRED_RULE_FIELDS_FOR_GAME_PHASE_B);
  } else {
    const serialized = serializeRules(rules) as Record<string, unknown>;
    for (const field of REQUIRED_RULE_FIELDS_FOR_GAME_PHASE_B) {
      if (serialized[field] == null) unsetRuleFields.push(field);
    }
    if (rules.clashPenaltyMode === 'FIXED_X' && rules.clashPenaltyX == null) {
      unsetRuleFields.push('clashPenaltyX');
    }
    if (rules.majorityPenaltyMode === 'FIXED_X' && rules.majorityPenaltyX == null) {
      unsetRuleFields.push('majorityPenaltyX');
    }
    if (rules.equalityMode === 'EPSILON' && rules.equalityEpsilon == null) {
      unsetRuleFields.push('equalityEpsilon');
    }
    if (rules.stdDevMode === 'SAMPLE' && rules.sampleStdDevForSingleValue == null) {
      unsetRuleFields.push('sampleStdDevForSingleValue');
    }
  }

  return {
    canMarkReady: issues.length === 0,
    issues,
    gamePhaseBRulesComplete: unsetRuleFields.length === 0,
    unsetRuleFields,
  };
}

async function syncPhaseBRounds(
  db: Db,
  eventId: string,
  count: number,
  defaultTimer: number,
): Promise<void> {
  const existing = await db.query.roundConfigs.findMany({
    where: and(eq(roundConfigs.eventId, eventId), eq(roundConfigs.gamePhase, 'B')),
  });
  const byNumber = new Map(existing.map((r) => [r.roundNumber, r]));
  for (let n = 1; n <= count; n += 1) {
    if (!byNumber.has(n)) {
      await db.insert(roundConfigs).values({
        eventId,
        gamePhase: 'B',
        roundNumber: n,
        statCard: null,
        timerSeconds: defaultTimer,
      });
    }
  }
  for (const row of existing) {
    if (row.roundNumber > count) {
      await db.delete(roundConfigs).where(eq(roundConfigs.id, row.id));
    }
  }
}

export async function ensureEvent(db: Db): Promise<Event> {
  const existing = await db.query.events.findFirst({
    orderBy: [asc(events.createdAt)],
  });
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(events)
      .values({ name: 'Digiverse', status: 'DRAFT' })
      .returning();
    if (!created) throw badRequest('Failed to create event');
    await tx.insert(eventRules).values({ eventId: created.id });
    const defaults = defaultCardSupply();
    await tx.insert(cardSupply).values(
      POWER_UP_CARDS.map((card) => ({
        eventId: created.id,
        cardType: card,
        maxSupply: defaults[card],
      })),
    );
    await tx.insert(roundConfigs).values({
      eventId: created.id,
      gamePhase: 'B',
      roundNumber: 1,
      statCard: null,
      timerSeconds: created.roundSelectionSeconds,
    });
    return created;
  });
}

export async function getEventBundle(db: Db) {
  const event = await ensureEvent(db);
  const rulesRow = await db.query.eventRules.findFirst({
    where: eq(eventRules.eventId, event.id),
  });
  if (!rulesRow) throw badRequest('Event rules row missing');

  const supplyRows = await db.query.cardSupply.findMany({
    where: eq(cardSupply.eventId, event.id),
    orderBy: [asc(cardSupply.cardType)],
  });
  const rounds = await db.query.roundConfigs.findMany({
    where: eq(roundConfigs.eventId, event.id),
    orderBy: [asc(roundConfigs.gamePhase), asc(roundConfigs.roundNumber)],
  });
  const sets = await db.query.questionSets.findMany({
    where: eq(questionSets.eventId, event.id),
    with: { questions: true },
    orderBy: [asc(questionSets.orderIndex)],
  });
  const readiness = await computeReadiness(db, event);

  return {
    event: serializeEvent(event),
    rules: serializeRules(rulesRow),
    cardSupply: supplyRows.map((row) => ({
      cardType: row.cardType,
      maxSupply: row.maxSupply,
    })),
    rounds: rounds.map((row) => ({
      id: row.id,
      gamePhase: row.gamePhase,
      roundNumber: row.roundNumber,
      statCard: row.statCard,
      timerSeconds: row.timerSeconds,
    })),
    questionSets: sets.map((set) => ({
      id: set.id,
      name: set.name,
      orderIndex: set.orderIndex,
      questions: [...set.questions]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((q) => ({
        id: q.id,
        setId: q.setId,
        prompt: q.prompt,
        answerDefinition: q.answerDefinition,
        matchingMode: q.matchingMode,
        timeLimitSeconds: q.timeLimitSeconds,
        mappedCard: q.mappedCard,
        topN: q.topN,
        orderIndex: q.orderIndex,
      })),
    })),
    readiness,
  };
}

export async function updateEventSettings(
  db: Db,
  input: {
    name?: string;
    gamePhaseARoundCount?: number;
    gamePhaseBRoundCount?: number;
    rapidFireDefaultTimeLimitSeconds?: number;
    roundSelectionSeconds?: number;
    statCardAnnouncementSeconds?: number;
  },
) {
  const event = await ensureEvent(db);
  assertDraft(event);

  if (input.gamePhaseARoundCount !== undefined && !isPositiveInt(input.gamePhaseARoundCount)) {
    throw badRequest('Game Phase A round count must be ≥ 1');
  }
  if (input.gamePhaseBRoundCount !== undefined && !isPositiveInt(input.gamePhaseBRoundCount)) {
    throw badRequest('Game Phase B round count must be ≥ 1');
  }
  if (
    input.rapidFireDefaultTimeLimitSeconds !== undefined &&
    !isPositiveInt(input.rapidFireDefaultTimeLimitSeconds)
  ) {
    throw badRequest('Rapid-fire default time limit must be ≥ 1 second');
  }
  if (input.roundSelectionSeconds !== undefined && !isPositiveInt(input.roundSelectionSeconds)) {
    throw badRequest('Round selection timer must be ≥ 1 second');
  }
  if (input.statCardAnnouncementSeconds !== undefined && input.statCardAnnouncementSeconds < 0) {
    throw badRequest('Stat-card announcement duration must be ≥ 0 seconds');
  }
  if (input.name !== undefined && !input.name.trim()) {
    throw badRequest('Event name is required');
  }

  const nextB = input.gamePhaseBRoundCount ?? event.gamePhaseBRoundCount;
  const nextTimer = input.roundSelectionSeconds ?? event.roundSelectionSeconds;

  await db
    .update(events)
    .set({
      name: input.name?.trim() ?? event.name,
      gamePhaseARoundCount: input.gamePhaseARoundCount ?? event.gamePhaseARoundCount,
      gamePhaseBRoundCount: nextB,
      rapidFireDefaultTimeLimitSeconds:
        input.rapidFireDefaultTimeLimitSeconds ?? event.rapidFireDefaultTimeLimitSeconds,
      roundSelectionSeconds: nextTimer,
      statCardAnnouncementSeconds:
        input.statCardAnnouncementSeconds ?? event.statCardAnnouncementSeconds,
      updatedAt: new Date(),
    })
    .where(eq(events.id, event.id));

  await syncPhaseBRounds(db, event.id, nextB, nextTimer);
  return getEventBundle(db);
}

export async function transitionEvent(db: Db, nextStatus: EventStatus) {
  const event = await ensureEvent(db);
  const allowed: Record<EventStatus, EventStatus[]> = {
    DRAFT: ['READY'],
    READY: ['DRAFT', 'LIVE'],
    LIVE: ['FINISHED', 'READY'],
    FINISHED: ['DRAFT'],
  };
  if (!allowed[event.status].includes(nextStatus)) {
    throw conflict(`Cannot transition from ${event.status} to ${nextStatus}`);
  }
  if (nextStatus === 'READY') {
    const readiness = await computeReadiness(db, event);
    if (!readiness.canMarkReady) {
      throw badRequest('Event is not ready', { issues: readiness.issues });
    }
  }
  await db
    .update(events)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(events.id, event.id));
  return getEventBundle(db);
}

type RulesPatch = Partial<ReturnType<typeof serializeRules>>;

function validateRulesPatch(patch: RulesPatch): void {
  if (patch.clashPenaltyX != null && !isNonNegativeDecimalString(String(patch.clashPenaltyX))) {
    throw badRequest('clashPenaltyX must be a non-negative decimal string');
  }
  if (patch.majorityPenaltyX != null && !isNonNegativeDecimalString(String(patch.majorityPenaltyX))) {
    throw badRequest('majorityPenaltyX must be a non-negative decimal string');
  }
  if (patch.equalityEpsilon != null && !isNonNegativeDecimalString(String(patch.equalityEpsilon))) {
    throw badRequest('equalityEpsilon must be a non-negative decimal string');
  }
  if (
    patch.rapidFireMaxAttempts != null &&
    (!Number.isInteger(patch.rapidFireMaxAttempts) || patch.rapidFireMaxAttempts < 1)
  ) {
    throw badRequest('rapidFireMaxAttempts must be an integer ≥ 1');
  }
  if (
    patch.maxCardsPlayedPerRoundPerTeam != null &&
    (!Number.isInteger(patch.maxCardsPlayedPerRoundPerTeam) ||
      patch.maxCardsPlayedPerRoundPerTeam < 1)
  ) {
    throw badRequest('maxCardsPlayedPerRoundPerTeam must be an integer ≥ 1');
  }
}

function rulesChangedKeys(current: ReturnType<typeof serializeRules>, patch: RulesPatch): string[] {
  const changed: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'updatedAt') continue;
    const currentValue = (current as Record<string, unknown>)[key];
    if (value !== undefined && String(currentValue ?? '') !== String(value ?? '')) {
      changed.push(key);
    }
  }
  return changed;
}

export async function updateRules(db: Db, patch: RulesPatch) {
  const event = await ensureEvent(db);
  const currentRow = await db.query.eventRules.findFirst({
    where: eq(eventRules.eventId, event.id),
  });
  if (!currentRow) throw badRequest('Event rules row missing');
  validateRulesPatch(patch);

  const current = serializeRules(currentRow);
  const changed = rulesChangedKeys(current, patch);
  if (event.status === 'FINISHED') {
    throw configLocked('Finished events cannot be edited');
  }
  if (event.status === 'READY') {
    throw configLocked('Configuration is locked at READY. Return to DRAFT to edit rules.');
  }
  if (event.status === 'LIVE') {
    const forbidden = changed.filter((k) => !LIVE_EDITABLE.has(k));
    if (forbidden.length > 0) {
      throw configLocked(
        `While LIVE, only organiser X values may change (${LIVE_EDITABLE_RULE_FIELDS.join(', ')}). Locked: ${forbidden.join(', ')}`,
      );
    }
  }

  const next: Partial<EventRules> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'updatedAt' || value === undefined) continue;
    if (event.status === 'LIVE' && !LIVE_EDITABLE.has(key as LiveEditableRuleField)) continue;
    (next as Record<string, unknown>)[key] = value;
  }

  await db.update(eventRules).set(next).where(eq(eventRules.eventId, event.id));
  return getEventBundle(db);
}

export async function updateCardSupply(db: Db, items: { cardType: PowerUpCard; maxSupply: number }[]) {
  const event = await ensureEvent(db);
  assertDraft(event);
  const map = defaultCardSupply();
  for (const item of items) {
    map[item.cardType] = item.maxSupply;
  }
  const issues = validateCardSupplyMap(map);
  const awards = await loadAwards(db, event.id);
  issues.push(...validateAwardedVsSupply(awards, map));
  if (issues.length > 0) throw badRequest('Invalid card supply', { issues });

  for (const card of POWER_UP_CARDS) {
    await db
      .update(cardSupply)
      .set({ maxSupply: map[card], updatedAt: new Date() })
      .where(and(eq(cardSupply.eventId, event.id), eq(cardSupply.cardType, card)));
  }
  return getEventBundle(db);
}

export async function updatePhaseBRounds(
  db: Db,
  rounds: { roundNumber: number; statCard: StatCard | null; timerSeconds: number }[],
) {
  const event = await ensureEvent(db);
  assertDraft(event);
  const seen = new Set<number>();
  for (const round of rounds) {
    if (!isPositiveInt(round.roundNumber)) throw badRequest('Round number must be ≥ 1');
    if (round.roundNumber > event.gamePhaseBRoundCount) {
      throw badRequest(`Round ${round.roundNumber} exceeds Game Phase B count`);
    }
    if (seen.has(round.roundNumber)) throw badRequest('Duplicate round number');
    seen.add(round.roundNumber);
    if (round.statCard === undefined) throw badRequest('Unknown stat card');
    if (!isPositiveInt(round.timerSeconds)) throw badRequest('Round timer must be ≥ 1 second');
  }

  for (const round of rounds) {
    await db
      .update(roundConfigs)
      .set({
        statCard: round.statCard,
        timerSeconds: round.timerSeconds,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(roundConfigs.eventId, event.id),
          eq(roundConfigs.gamePhase, 'B'),
          eq(roundConfigs.roundNumber, round.roundNumber),
        ),
      );
  }
  return getEventBundle(db);
}

export async function createQuestionSet(db: Db, name: string) {
  const event = await ensureEvent(db);
  assertDraft(event);
  const trimmed = name.trim();
  if (!trimmed) throw badRequest('Set name is required');
  const existing = await db.query.questionSets.findMany({
    where: eq(questionSets.eventId, event.id),
  });
  const orderIndex = existing.reduce((max, s) => Math.max(max, s.orderIndex), 0) + 1;
  const [created] = await db
    .insert(questionSets)
    .values({ eventId: event.id, name: trimmed, orderIndex })
    .returning();
  if (!created) throw badRequest('Failed to create question set');
  return getEventBundle(db);
}

export async function updateQuestionSet(db: Db, setId: string, input: { name?: string; orderIndex?: number }) {
  const event = await ensureEvent(db);
  assertDraft(event);
  const set = await db.query.questionSets.findFirst({ where: eq(questionSets.id, setId) });
  if (!set || set.eventId !== event.id) throw notFound('Question set not found');
  if (input.name !== undefined && !input.name.trim()) throw badRequest('Set name is required');
  await db
    .update(questionSets)
    .set({
      name: input.name?.trim() ?? set.name,
      orderIndex: input.orderIndex ?? set.orderIndex,
      updatedAt: new Date(),
    })
    .where(eq(questionSets.id, setId));
  return getEventBundle(db);
}

export async function deleteQuestionSet(db: Db, setId: string) {
  const event = await ensureEvent(db);
  assertDraft(event);
  const set = await db.query.questionSets.findFirst({ where: eq(questionSets.id, setId) });
  if (!set || set.eventId !== event.id) throw notFound('Question set not found');
  await db.delete(questionSets).where(eq(questionSets.id, setId));
  return getEventBundle(db);
}

export type QuestionInput = {
  prompt: string;
  answerDefinition: string;
  matchingMode: 'EXACT' | 'NORMALIZED' | 'NUMERIC';
  timeLimitSeconds: number;
  mappedCard: PowerUpCard | null;
  topN: number;
};

function validateQuestionInput(input: QuestionInput): void {
  if (!input.prompt.trim()) throw badRequest('Question text is required');
  if (!input.answerDefinition.trim()) throw badRequest('Answer definition is required');
  if (!isPositiveInt(input.timeLimitSeconds)) throw badRequest('Time limit must be ≥ 1 second');
  if (!isPositiveInt(input.topN)) throw badRequest('top-N awardees must be ≥ 1');
}

async function assertMappingFits(db: Db, eventId: string, awards: MappedAward[]) {
  const supply = await loadSupplyMap(db, eventId);
  const issues = validateAwardedVsSupply(awards, supply);
  if (issues.length > 0) throw badRequest('Invalid card mapping', { issues });
}

export async function createQuestion(db: Db, setId: string, input: QuestionInput) {
  const event = await ensureEvent(db);
  assertDraft(event);
  validateQuestionInput(input);
  const set = await db.query.questionSets.findFirst({ where: eq(questionSets.id, setId) });
  if (!set || set.eventId !== event.id) throw notFound('Question set not found');

  const existingAwards = await loadAwards(db, event.id);
  await assertMappingFits(db, event.id, [...existingAwards, { card: input.mappedCard, topN: input.topN }]);

  const siblings = await db.query.questions.findMany({ where: eq(questions.setId, setId) });
  const orderIndex = siblings.reduce((max, q) => Math.max(max, q.orderIndex), 0) + 1;
  await db.insert(questions).values({
    setId,
    prompt: input.prompt.trim(),
    answerDefinition: input.answerDefinition.trim(),
    matchingMode: input.matchingMode,
    timeLimitSeconds: input.timeLimitSeconds,
    mappedCard: input.mappedCard,
    topN: input.topN,
    orderIndex,
  });
  return getEventBundle(db);
}

export async function updateQuestion(db: Db, questionId: string, input: Partial<QuestionInput>) {
  const event = await ensureEvent(db);
  assertDraft(event);
  const question = await db.query.questions.findFirst({
    where: eq(questions.id, questionId),
    with: { set: true },
  });
  if (!question || question.set.eventId !== event.id) throw notFound('Question not found');

  const next: QuestionInput = {
    prompt: input.prompt ?? question.prompt,
    answerDefinition: input.answerDefinition ?? question.answerDefinition,
    matchingMode: input.matchingMode ?? question.matchingMode,
    timeLimitSeconds: input.timeLimitSeconds ?? question.timeLimitSeconds,
    mappedCard: input.mappedCard === undefined ? question.mappedCard : input.mappedCard,
    topN: input.topN ?? question.topN,
  };
  validateQuestionInput(next);

  const sets = await db.query.questionSets.findMany({
    where: eq(questionSets.eventId, event.id),
    with: { questions: true },
  });
  const rebuilt: MappedAward[] = [];
  for (const set of sets) {
    for (const q of set.questions) {
      if (q.id === questionId) {
        rebuilt.push({ card: next.mappedCard, topN: next.topN });
      } else {
        rebuilt.push({ card: q.mappedCard, topN: q.topN });
      }
    }
  }
  await assertMappingFits(db, event.id, rebuilt);

  await db
    .update(questions)
    .set({
      prompt: next.prompt.trim(),
      answerDefinition: next.answerDefinition.trim(),
      matchingMode: next.matchingMode,
      timeLimitSeconds: next.timeLimitSeconds,
      mappedCard: next.mappedCard,
      topN: next.topN,
      updatedAt: new Date(),
    })
    .where(eq(questions.id, questionId));
  return getEventBundle(db);
}

export async function deleteQuestion(db: Db, questionId: string) {
  const event = await ensureEvent(db);
  assertDraft(event);
  const question = await db.query.questions.findFirst({
    where: eq(questions.id, questionId),
    with: { set: true },
  });
  if (!question || question.set.eventId !== event.id) throw notFound('Question not found');
  await db.delete(questions).where(eq(questions.id, questionId));
  return getEventBundle(db);
}
