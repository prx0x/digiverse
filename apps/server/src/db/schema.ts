import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
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

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.id], references: [teams.userId] }),
  sessions: many(sessions),
}));

export const teamsRelations = relations(teams, ({ one }) => ({
  user: one(users, { fields: [teams.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  rules: one(eventRules, { fields: [events.id], references: [eventRules.eventId] }),
  cardSupply: many(cardSupply),
  questionSets: many(questionSets),
  roundConfigs: many(roundConfigs),
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

export const questionsRelations = relations(questions, ({ one }) => ({
  set: one(questionSets, { fields: [questions.setId], references: [questionSets.id] }),
}));

export const roundConfigsRelations = relations(roundConfigs, ({ one }) => ({
  event: one(events, { fields: [roundConfigs.eventId], references: [events.id] }),
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
