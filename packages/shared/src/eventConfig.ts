/** Shared event-configuration enums and validation for Build Phase 3. */

export const EVENT_STATUSES = ['DRAFT', 'READY', 'LIVE', 'FINISHED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const POWER_UP_CARDS = ['SHIELD', 'RESERVE', 'PEEK', 'REVERSE'] as const;
export type PowerUpCard = (typeof POWER_UP_CARDS)[number];

export const STAT_CARDS = [
  'MEAN',
  'TWO_THIRDS',
  'MIDRANGE',
  'MEAN_PLUS_SIGMA',
  'GEOMETRIC_MEAN',
] as const;
export type StatCard = (typeof STAT_CARDS)[number];

export const GAME_PHASES = ['A', 'B'] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

export const MATCHING_MODES = ['EXACT', 'NORMALIZED', 'NUMERIC'] as const;
export type MatchingMode = (typeof MATCHING_MODES)[number];

export const CLASH_PENALTY_MODES = ['FIXED_X', 'TWO_THIRDS_OF_PICK'] as const;
export type ClashPenaltyMode = (typeof CLASH_PENALTY_MODES)[number];

export const MAJORITY_PENALTY_MODES = [
  'FIXED_X',
  'HALF_ABS_DISTANCE',
  'HALF_SIGNED_DISTANCE',
] as const;
export type MajorityPenaltyMode = (typeof MAJORITY_PENALTY_MODES)[number];

export const REVERSED_MAJORITY_REWARDS = ['PICK', 'OTHER'] as const;
export type ReversedMajorityReward = (typeof REVERSED_MAJORITY_REWARDS)[number];

export const STD_DEV_MODES = ['POPULATION', 'SAMPLE'] as const;
export type StdDevMode = (typeof STD_DEV_MODES)[number];

export const SAMPLE_STDDEV_SINGLE_BEHAVIOURS = ['ZERO', 'NO_TARGET'] as const;
export type SampleStdDevSingleBehaviour = (typeof SAMPLE_STDDEV_SINGLE_BEHAVIOURS)[number];

export const EQUALITY_MODES = ['EXACT', 'ROUND_TARGET_TO_INTEGER', 'EPSILON'] as const;
export type EqualityMode = (typeof EQUALITY_MODES)[number];

export const DISPLAY_ROUNDING_MODES = ['HALF_UP', 'TRUNCATE'] as const;
export type DisplayRoundingMode = (typeof DISPLAY_ROUNDING_MODES)[number];

export const NO_PICK_BEHAVIOURS = ['SCORE_ZERO', 'EXCLUDE', 'AUTO_RANDOM'] as const;
export type NoPickBehaviour = (typeof NO_PICK_BEHAVIOURS)[number];

export const DEGENERATE_ROUND_MODES = ['NO_TARGET', 'CLASH_PENALTIES_ONLY'] as const;
export type DegenerateRoundMode = (typeof DEGENERATE_ROUND_MODES)[number];

export const RAPID_FIRE_TIE_BREAKS = ['EARLIEST_RECEIVED_THEN_ID', 'SHARE'] as const;
export type RapidFireTieBreak = (typeof RAPID_FIRE_TIE_BREAKS)[number];

/** Fields organisers may change while the event is LIVE (rulebook X). */
export const LIVE_EDITABLE_RULE_FIELDS = ['clashPenaltyX', 'majorityPenaltyX'] as const;
export type LiveEditableRuleField = (typeof LIVE_EDITABLE_RULE_FIELDS)[number];

export const REQUIRED_RULE_FIELDS_FOR_GAME_PHASE_B = [
  'clashPenaltyMode',
  'majorityPenaltyMode',
  'reversedMajorityReward',
  'stdDevMode',
  'equalityMode',
  'displayRounding',
  'noPickBehaviour',
  'degenerateRoundMode',
] as const;

export type MappedAward = {
  card: PowerUpCard | null;
  topN: number;
};

export type CardSupplyMap = Record<PowerUpCard, number>;

const NON_NEGATIVE_DECIMAL = /^(0|[1-9]\d*)(\.\d+)?$/;

export function isNonNegativeDecimalString(value: string): boolean {
  return NON_NEGATIVE_DECIMAL.test(value.trim());
}

export function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

export function defaultCardSupply(): CardSupplyMap {
  return { SHIELD: 0, RESERVE: 1, PEEK: 0, REVERSE: 0 };
}

export function validateCardSupplyMap(supply: CardSupplyMap): string[] {
  const issues: string[] = [];
  for (const card of POWER_UP_CARDS) {
    const n = supply[card];
    if (!Number.isInteger(n) || n < 0) {
      issues.push(`${card} max supply must be an integer ≥ 0`);
    }
  }
  if (supply.RESERVE !== 1) {
    issues.push('Reserve max supply must be exactly 1 (official rulebook)');
  }
  return issues;
}

export function validateAwardedVsSupply(awards: MappedAward[], supply: CardSupplyMap): string[] {
  const issues = validateCardSupplyMap(supply);
  const totals: CardSupplyMap = { SHIELD: 0, RESERVE: 0, PEEK: 0, REVERSE: 0 };

  for (const award of awards) {
    if (award.topN < 1) {
      issues.push('top-N awardees must be ≥ 1');
    }
    if (!award.card) continue;
    totals[award.card] += award.topN;
  }

  for (const card of POWER_UP_CARDS) {
    if (totals[card] > supply[card]) {
      issues.push(
        `${card} mapped awards (${totals[card]}) exceed configured max supply (${supply[card]})`,
      );
    }
  }

  return issues;
}

export function isValidStatCard(value: string): value is StatCard {
  return (STAT_CARDS as readonly string[]).includes(value);
}

export function isValidPowerUpCard(value: string): value is PowerUpCard {
  return (POWER_UP_CARDS as readonly string[]).includes(value);
}
