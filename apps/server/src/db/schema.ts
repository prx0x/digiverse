import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'team']);
export const eventStatusEnum = pgEnum('event_status', ['DRAFT', 'READY', 'LIVE', 'FINISHED']);
export const powerUpCardEnum = pgEnum('power_up_card', ['SHIELD', 'RESERVE', 'PEEK', 'REVERSE']);
export const statCardEnum = pgEnum('stat_card', [
  'MEAN',
  'TWO_THIRDS',
  'MIDRANGE',
  'MEAN_PLUS_SIGMA',
  'GEOMETRIC_MEAN',
]);
export const gamePhaseEnum = pgEnum('game_phase', ['A', 'B']);
export const matchingModeEnum = pgEnum('matching_mode', ['EXACT', 'NORMALIZED', 'NUMERIC']);
export const questionTypeEnum = pgEnum('question_type', ['TEXT', 'MCQ']);
export const clashPenaltyModeEnum = pgEnum('clash_penalty_mode', ['FIXED_X', 'TWO_THIRDS_OF_PICK']);
export const majorityPenaltyModeEnum = pgEnum('majority_penalty_mode', [
  'FIXED_X',
  'HALF_ABS_DISTANCE',
  'HALF_SIGNED_DISTANCE',
]);
export const reversedMajorityRewardEnum = pgEnum('reversed_majority_reward', ['PICK', 'OTHER']);
export const stdDevModeEnum = pgEnum('std_dev_mode', ['POPULATION', 'SAMPLE']);
export const sampleStdDevSingleEnum = pgEnum('sample_stddev_single', ['ZERO', 'NO_TARGET']);
export const equalityModeEnum = pgEnum('equality_mode', [
  'EXACT',
  'ROUND_TARGET_TO_INTEGER',
  'EPSILON',
]);
export const displayRoundingEnum = pgEnum('display_rounding', ['HALF_UP', 'TRUNCATE']);
export const noPickBehaviourEnum = pgEnum('no_pick_behaviour', [
  'SCORE_ZERO',
  'EXCLUDE',
  'AUTO_RANDOM',
]);
export const degenerateRoundModeEnum = pgEnum('degenerate_round_mode', [
  'NO_TARGET',
  'CLASH_PENALTIES_ONLY',
]);
export const rapidFireTieBreakEnum = pgEnum('rapid_fire_tie_break', [
  'EARLIEST_RECEIVED_THEN_ID',
  'SHARE',
]);
export const rapidFireStatusEnum = pgEnum('rapid_fire_status', [
  'IDLE',
  'QUESTION_OPEN',
  'CLOSED',
  'AWARDED',
]);
export const roundStatusEnum = pgEnum('round_status', [
  'LOBBY',
  'SELECTION',
  'CLASH_RESOLUTION',
  'CALCULATION',
  'BUCKETING',
  'SCORING',
  'RESULT',
  'ABORTED',
]);
export const scoreLedgerComponentEnum = pgEnum('score_ledger_component', [
  'STARTING_POINTS',
  'CLASH_PENALTY',
  'MAJORITY_DEDUCTION',
  'REVERSED_MINORITY_DEDUCTION',
  'REVERSED_MAJORITY_AWARD',
  'MINORITY_AWARD',
  'EXACT_MATCH_AWARD',
  'TIE_ZERO',
  'NO_PICK_PENALTY',
  'MANUAL_ADJUSTMENT',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  identifier: varchar('identifier', { length: 128 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  tag: varchar('tag', { length: 32 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull().default('Digiverse'),
  status: eventStatusEnum('status').notNull().default('DRAFT'),
  gamePhaseARoundCount: integer('game_phase_a_round_count').notNull().default(1),
  gamePhaseBRoundCount: integer('game_phase_b_round_count').notNull().default(1),
  rapidFireDefaultTimeLimitSeconds: integer('rapid_fire_default_time_limit_seconds')
    .notNull()
    .default(30),
  roundSelectionSeconds: integer('round_selection_seconds').notNull().default(60),
  statCardAnnouncementSeconds: integer('stat_card_announcement_seconds').notNull().default(8),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const eventRules = pgTable('event_rules', {
  eventId: uuid('event_id')
    .primaryKey()
    .references(() => events.id, { onDelete: 'cascade' }),
  clashPenaltyMode: clashPenaltyModeEnum('clash_penalty_mode'),
  clashPenaltyX: numeric('clash_penalty_x', { precision: 20, scale: 10 }),
  majorityPenaltyMode: majorityPenaltyModeEnum('majority_penalty_mode'),
  majorityPenaltyX: numeric('majority_penalty_x', { precision: 20, scale: 10 }),
  reversedMajorityReward: reversedMajorityRewardEnum('reversed_majority_reward'),
  reverseAffectsEqualTo: boolean('reverse_affects_equal_to'),
  reverseAffectsTiebreaker: boolean('reverse_affects_tiebreaker'),
  reverseIsGlobal: boolean('reverse_is_global'),
  shieldCoversClash: boolean('shield_covers_clash'),
  shieldCoversMajority: boolean('shield_covers_majority'),
  shieldCoversReversedMinority: boolean('shield_covers_reversed_minority'),
  shieldConsumedOnPlay: boolean('shield_consumed_on_play'),
  stdDevMode: stdDevModeEnum('std_dev_mode'),
  sampleStdDevForSingleValue: sampleStdDevSingleEnum('sample_stddev_for_single_value'),
  degenerateRoundMode: degenerateRoundModeEnum('degenerate_round_mode'),
  equalityMode: equalityModeEnum('equality_mode'),
  equalityEpsilon: numeric('equality_epsilon', { precision: 20, scale: 10 }),
  displayRounding: displayRoundingEnum('display_rounding'),
  maxCardsPlayedPerRoundPerTeam: integer('max_cards_played_per_round_per_team'),
  allowMultipleReversePerTeam: boolean('allow_multiple_reverse_per_team'),
  unusedCardsCarryForward: boolean('unused_cards_carry_forward'),
  cardsConsumedEvenIfNoEffect: boolean('cards_consumed_even_if_no_effect'),
  noPickBehaviour: noPickBehaviourEnum('no_pick_behaviour'),
  allowPickChangeBeforeLock: boolean('allow_pick_change_before_lock'),
  preRoundCardsLobbyOnly: boolean('pre_round_cards_lobby_only'),
  rapidFireTieBreak: rapidFireTieBreakEnum('rapid_fire_tie_break'),
  rapidFireMaxAttempts: integer('rapid_fire_max_attempts'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cardSupply = pgTable(
  'card_supply',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    cardType: powerUpCardEnum('card_type').notNull(),
    maxSupply: integer('max_supply').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('card_supply_event_card_unique').on(t.eventId, t.cardType)],
);

export const questionSets = pgTable('question_sets', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  orderIndex: integer('order_index').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  setId: uuid('set_id')
    .notNull()
    .references(() => questionSets.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  answerDefinition: text('answer_definition').notNull(),
  matchingMode: matchingModeEnum('matching_mode').notNull().default('NORMALIZED'),
  questionType: questionTypeEnum('question_type').notNull().default('TEXT'),
  options: jsonb('options').$type<string[]>(),
  timeLimitSeconds: integer('time_limit_seconds').notNull(),
  mappedCard: powerUpCardEnum('mapped_card'),
  topN: integer('top_n').notNull().default(1),
  orderIndex: integer('order_index').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roundConfigs = pgTable(
  'round_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    gamePhase: gamePhaseEnum('game_phase').notNull(),
    roundNumber: integer('round_number').notNull(),
    statCard: statCardEnum('stat_card'),
    timerSeconds: integer('timer_seconds').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('round_configs_event_phase_number_unique').on(t.eventId, t.gamePhase, t.roundNumber)],
);

export const rapidFireSessions = pgTable('rapid_fire_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  status: rapidFireStatusEnum('status').notNull().default('IDLE'),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  awardedAt: timestamp('awarded_at', { withTimezone: true }),
  timeLimitSeconds: integer('time_limit_seconds').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rapidFireSubmissions = pgTable(
  'rapid_fire_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => rapidFireSessions.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    rawAnswer: text('raw_answer').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    attemptNumber: integer('attempt_number').notNull().default(1),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('rf_submissions_session_team_attempt_unique').on(t.sessionId, t.teamId, t.attemptNumber)],
);

export const teamCards = pgTable('team_cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  cardType: powerUpCardEnum('card_type').notNull(),
  acquiredFrom: varchar('acquired_from', { length: 32 }).notNull().default('RAPID_FIRE'),
  questionId: uuid('question_id').references(() => questions.id, { onDelete: 'set null' }),
  usedInRoundId: uuid('used_in_round_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rapidFireAwards = pgTable('rapid_fire_awards', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => rapidFireSessions.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  cardType: powerUpCardEnum('card_type').notNull(),
  rank: integer('rank').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gameRounds = pgTable(
  'game_rounds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    statCard: statCardEnum('stat_card').notNull(),
    status: roundStatusEnum('status').notNull().default('LOBBY'),
    lobbySeconds: integer('lobby_seconds').notNull().default(15),
    selectionSeconds: integer('selection_seconds').notNull().default(60),
    lobbyStartedAt: timestamp('lobby_started_at', { withTimezone: true }),
    selectionStartedAt: timestamp('selection_started_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    targetValue: numeric('target_value', { precision: 20, scale: 10 }),
    displayTarget: varchar('display_target', { length: 32 }),
    isDegenerate: boolean('is_degenerate').notNull().default(false),
    isPractice: boolean('is_practice').notNull().default(false),
    scoreMultiplier: integer('score_multiplier').notNull().default(1),
    reverseCount: integer('reverse_count').notNull().default(0),
    isReversed: boolean('is_reversed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('game_rounds_event_number_unique').on(t.eventId, t.roundNumber)],
);

export const roundPalettes = pgTable(
  'round_palettes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => gameRounds.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    paletteNumbers: text('palette_numbers').notNull(),
    seed: varchar('seed', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('round_palettes_round_team_unique').on(t.roundId, t.teamId)],
);

export const roundPicks = pgTable(
  'round_picks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => gameRounds.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    pick: integer('pick').notNull(),
    isLocked: boolean('is_locked').notNull().default(true),
    isReservePick: boolean('is_reserve_pick').notNull().default(false),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('round_picks_round_team_unique').on(t.roundId, t.teamId)],
);

export const roundCardPlays = pgTable(
  'round_card_plays',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => gameRounds.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    cardType: powerUpCardEnum('card_type').notNull(),
    phase: varchar('phase', { length: 16 }).notNull(),
    metadata: text('metadata'),
    playedAt: timestamp('played_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('round_card_plays_round_team_unique').on(t.roundId, t.teamId)],
);

export const scoreLedger = pgTable('score_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  roundId: uuid('round_id').references(() => gameRounds.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  component: scoreLedgerComponentEnum('component').notNull(),
  pointsDelta: numeric('points_delta', { precision: 20, scale: 10 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 20, scale: 10 }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roundAuditLogs = pgTable('round_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  roundId: uuid('round_id').references(() => gameRounds.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 64 }).notNull(),
  adminUserId: uuid('admin_user_id').references(() => users.id, { onDelete: 'set null' }),
  details: text('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.id], references: [teams.userId] }),
  sessions: many(sessions),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  user: one(users, { fields: [teams.userId], references: [users.id] }),
  cards: many(teamCards),
  submissions: many(rapidFireSubmissions),
  awards: many(rapidFireAwards),
  palettes: many(roundPalettes),
  picks: many(roundPicks),
  cardPlays: many(roundCardPlays),
  ledger: many(scoreLedger),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  rules: one(eventRules, { fields: [events.id], references: [eventRules.eventId] }),
  cardSupply: many(cardSupply),
  questionSets: many(questionSets),
  roundConfigs: many(roundConfigs),
  rapidFireSessions: many(rapidFireSessions),
  teamCards: many(teamCards),
  gameRounds: many(gameRounds),
  scoreLedger: many(scoreLedger),
  roundAuditLogs: many(roundAuditLogs),
}));

export const eventRulesRelations = relations(eventRules, ({ one }) => ({
  event: one(events, { fields: [eventRules.eventId], references: [events.id] }),
}));

export const cardSupplyRelations = relations(cardSupply, ({ one }) => ({
  event: one(events, { fields: [cardSupply.eventId], references: [events.id] }),
}));

export const questionSetsRelations = relations(questionSets, ({ one, many }) => ({
  event: one(events, { fields: [questionSets.eventId], references: [events.id] }),
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  set: one(questionSets, { fields: [questions.setId], references: [questionSets.id] }),
  rapidFireSessions: many(rapidFireSessions),
}));

export const roundConfigsRelations = relations(roundConfigs, ({ one }) => ({
  event: one(events, { fields: [roundConfigs.eventId], references: [events.id] }),
}));

export const rapidFireSessionsRelations = relations(rapidFireSessions, ({ one, many }) => ({
  event: one(events, { fields: [rapidFireSessions.eventId], references: [events.id] }),
  question: one(questions, { fields: [rapidFireSessions.questionId], references: [questions.id] }),
  submissions: many(rapidFireSubmissions),
  awards: many(rapidFireAwards),
}));

export const rapidFireSubmissionsRelations = relations(rapidFireSubmissions, ({ one }) => ({
  session: one(rapidFireSessions, { fields: [rapidFireSubmissions.sessionId], references: [rapidFireSessions.id] }),
  team: one(teams, { fields: [rapidFireSubmissions.teamId], references: [teams.id] }),
}));

export const teamCardsRelations = relations(teamCards, ({ one }) => ({
  event: one(events, { fields: [teamCards.eventId], references: [events.id] }),
  team: one(teams, { fields: [teamCards.teamId], references: [teams.id] }),
  question: one(questions, { fields: [teamCards.questionId], references: [questions.id] }),
}));

export const rapidFireAwardsRelations = relations(rapidFireAwards, ({ one }) => ({
  session: one(rapidFireSessions, { fields: [rapidFireAwards.sessionId], references: [rapidFireSessions.id] }),
  team: one(teams, { fields: [rapidFireAwards.teamId], references: [teams.id] }),
}));

export const gameRoundsRelations = relations(gameRounds, ({ one, many }) => ({
  event: one(events, { fields: [gameRounds.eventId], references: [events.id] }),
  palettes: many(roundPalettes),
  picks: many(roundPicks),
  cardPlays: many(roundCardPlays),
  ledger: many(scoreLedger),
  auditLogs: many(roundAuditLogs),
}));

export const roundPalettesRelations = relations(roundPalettes, ({ one }) => ({
  round: one(gameRounds, { fields: [roundPalettes.roundId], references: [gameRounds.id] }),
  team: one(teams, { fields: [roundPalettes.teamId], references: [teams.id] }),
}));

export const roundPicksRelations = relations(roundPicks, ({ one }) => ({
  round: one(gameRounds, { fields: [roundPicks.roundId], references: [gameRounds.id] }),
  team: one(teams, { fields: [roundPicks.teamId], references: [teams.id] }),
}));

export const roundCardPlaysRelations = relations(roundCardPlays, ({ one }) => ({
  round: one(gameRounds, { fields: [roundCardPlays.roundId], references: [gameRounds.id] }),
  team: one(teams, { fields: [roundCardPlays.teamId], references: [teams.id] }),
}));

export const scoreLedgerRelations = relations(scoreLedger, ({ one }) => ({
  event: one(events, { fields: [scoreLedger.eventId], references: [events.id] }),
  round: one(gameRounds, { fields: [scoreLedger.roundId], references: [gameRounds.id] }),
  team: one(teams, { fields: [scoreLedger.teamId], references: [teams.id] }),
}));

export const roundAuditLogsRelations = relations(roundAuditLogs, ({ one }) => ({
  event: one(events, { fields: [roundAuditLogs.eventId], references: [events.id] }),
  round: one(gameRounds, { fields: [roundAuditLogs.roundId], references: [gameRounds.id] }),
  adminUser: one(users, { fields: [roundAuditLogs.adminUserId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventRules = typeof eventRules.$inferSelect;
export type CardSupply = typeof cardSupply.$inferSelect;
export type QuestionSet = typeof questionSets.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type RoundConfig = typeof roundConfigs.$inferSelect;
export type RapidFireSession = typeof rapidFireSessions.$inferSelect;
export type RapidFireSubmission = typeof rapidFireSubmissions.$inferSelect;
export type TeamCard = typeof teamCards.$inferSelect;
export type RapidFireAward = typeof rapidFireAwards.$inferSelect;
export type GameRound = typeof gameRounds.$inferSelect;
export type RoundPalette = typeof roundPalettes.$inferSelect;
export type RoundPick = typeof roundPicks.$inferSelect;
export type RoundCardPlay = typeof roundCardPlays.$inferSelect;
export type ScoreLedger = typeof scoreLedger.$inferSelect;
export type RoundAuditLog = typeof roundAuditLogs.$inferSelect;
