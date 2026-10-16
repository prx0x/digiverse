export { Decimal } from './decimal.js';

export {
  computeStatistic,
} from './statistics.js';
export type { StatisticOptions } from './statistics.js';

export { resolveClashes } from './clashes.js';

export { bucketize } from './bucketing.js';

export { scoreRound } from './scoring.js';
export type { ScoreRoundParams } from './scoring.js';

export { generateShuffledPalette } from './palette.js';

export {
  CARD_WINDOWS,
  evaluatePeek,
  validateCardPlay,
} from './cards.js';
export type { CardPlayValidationResult, CardPlayWindow } from './cards.js';

export {
  ROUND_TRANSITIONS,
  assertValidTransition,
  canTransitionRound,
} from './stateMachine.js';

export type {
  BucketClassification,
  BucketedPicks,
  CardPlay,
  ClashResolution,
  EngineRuleConfig,
  RoundScoreResult,
  RoundState,
  ScoreLedgerComponent,
  TeamPick,
  TeamRoundSummary,
  TeamScoreDelta,
} from './types.js';
