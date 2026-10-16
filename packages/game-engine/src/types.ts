import type {
  ClashPenaltyMode,
  DegenerateRoundMode,
  DisplayRoundingMode,
  EqualityMode,
  MajorityPenaltyMode,
  PowerUpCard,
  StatCard,
  StdDevMode,
} from '@digiverse/shared';

export type RoundState =
  | 'LOBBY'
  | 'SELECTION'
  | 'CLASH_RESOLUTION'
  | 'CALCULATION'
  | 'BUCKETING'
  | 'SCORING'
  | 'RESULT'
  | 'ABORTED';

export type TeamPick = {
  teamId: string;
  pick: number;
};

export type CardPlay = {
  teamId: string;
  card: PowerUpCard;
  phase: 'LOBBY' | 'SELECTION';
  metadata?: {
    reservedNumber?: number;
    peekCount?: number;
  };
};

export type ClashResolution = {
  validPicks: TeamPick[];
  clashingPicks: TeamPick[];
  clashGroups: Record<number, string[]>;
};

export type BucketClassification = 'GREATER' | 'EQUAL' | 'LESS';

export type BucketedPicks = {
  greater: TeamPick[];
  equal: TeamPick[];
  less: TeamPick[];
};

export type ScoreLedgerComponent =
  | 'STARTING_POINTS'
  | 'CLASH_PENALTY'
  | 'MAJORITY_DEDUCTION'
  | 'REVERSED_MINORITY_DEDUCTION'
  | 'REVERSED_MAJORITY_AWARD'
  | 'MINORITY_AWARD'
  | 'EXACT_MATCH_AWARD'
  | 'TIE_ZERO'
  | 'NO_PICK_PENALTY'
  | 'MANUAL_ADJUSTMENT';

export type TeamScoreDelta = {
  teamId: string;
  delta: string;
  component: ScoreLedgerComponent;
  details?: string;
  shieldProtected?: boolean;
};

export type EngineRuleConfig = {
  clashPenaltyMode?: ClashPenaltyMode;
  clashPenaltyX?: string | number;
  majorityPenaltyMode?: MajorityPenaltyMode;
  majorityPenaltyX?: string | number;
  shieldCoversClash?: boolean;
  shieldCoversMajority?: boolean;
  shieldCoversReversedMinority?: boolean;
  shieldCoversNoPick?: boolean;
  stdDevMode?: StdDevMode;
  sampleStdDevForSingleValue?: 'ZERO' | 'NO_TARGET';
  equalityMode?: EqualityMode;
  equalityEpsilon?: string | number;
  displayRounding?: DisplayRoundingMode;
  degenerateRoundMode?: DegenerateRoundMode;
  scoreMultiplier?: number;
};

export type TeamRoundSummary = {
  teamId: string;
  startScore: string;
  delta: string;
  finalScore: string;
  pick?: number;
  status: 'VALID' | 'CLASH' | 'NO_PICK';
  bucket?: BucketClassification;
  cardPlayed?: PowerUpCard;
  shieldProtected?: boolean;
  reason: string;
};

export type RoundScoreResult = {
  statCard: StatCard;
  target: string | null;
  displayTarget: string | null;
  isDegenerate: boolean;
  validPicks: TeamPick[];
  clashingPicks: TeamPick[];
  noPickTeams: string[];
  buckets: BucketedPicks;
  majorityBucket: 'GREATER' | 'LESS' | 'TIE' | 'EMPTY';
  reverseCount: number;
  isReversed: boolean;
  deltas: TeamScoreDelta[];
  teamSummaries: Record<string, TeamRoundSummary>;
};
