import { formatScore } from '@digiverse/shared';
import { bucketize } from './bucketing.js';
import { resolveClashes } from './clashes.js';
import { Decimal } from './decimal.js';
import { computeStatistic } from './statistics.js';
import type {
  CardPlay,
  EngineRuleConfig,
  RoundScoreResult,
  ScoreLedgerComponent,
  TeamPick,
  TeamRoundSummary,
  TeamScoreDelta,
} from './types.js';

export type ScoreRoundParams = {
  statCard: import('@digiverse/shared').StatCard;
  picks: TeamPick[];
  allTeamIds: string[];
  currentScores?: Record<string, string | number>;
  cardPlays?: CardPlay[];
  config?: EngineRuleConfig;
};

/**
 * Pure scoring function for a Game Phase B round.
 * Computes clashes, statistical target, bucketing, card interactions,
 * ledger deltas, and per-team summaries with high decimal precision.
 */
export function scoreRound(params: ScoreRoundParams): RoundScoreResult {
  const {
    statCard,
    picks,
    allTeamIds,
    currentScores = {},
    cardPlays = [],
    config = {},
  } = params;

  const multiplier = new Decimal(config.scoreMultiplier ?? 1);

  // Group played cards by team
  const teamCards = new Map<string, CardPlay[]>();
  for (const play of cardPlays) {
    const list = teamCards.get(play.teamId) ?? [];
    list.push(play);
    teamCards.set(play.teamId, list);
  }

  const hasShield = (teamId: string): boolean => {
    const plays = teamCards.get(teamId) ?? [];
    return plays.some((p) => p.card === 'SHIELD');
  };

  const reverseCount = cardPlays.filter((p) => p.card === 'REVERSE').length;
  const isReversed = reverseCount % 2 === 1;

  // 1. Resolve clashes
  const clashRes = resolveClashes(picks);
  const pickedTeamIds = new Set(picks.map((p) => p.teamId));

  // 2. Identify no-pick teams
  const noPickTeams = allTeamIds.filter((id) => !pickedTeamIds.has(id));

  // 3. Compute statistical target over valid picks
  const validPickValues = clashRes.validPicks.map((p) => p.pick);
  const targetDecimal = computeStatistic(statCard, validPickValues, {
    stdDevMode: config.stdDevMode ?? 'POPULATION',
    sampleStdDevForSingleValue: config.sampleStdDevForSingleValue ?? 'ZERO',
  });

  const isDegenerate = targetDecimal === null;
  const targetStr = targetDecimal !== null ? targetDecimal.toString() : null;
  const displayTarget =
    targetDecimal !== null
      ? formatScore(targetDecimal.toString())
      : null;

  const deltas: TeamScoreDelta[] = [];
  const teamSummaries: Record<string, TeamRoundSummary> = {};

  const getStartScore = (teamId: string): Decimal => {
    const raw = currentScores[teamId];
    return raw !== undefined ? new Decimal(raw) : new Decimal(0);
  };

  const addDelta = (
    teamId: string,
    unmultipliedDelta: Decimal,
    component: ScoreLedgerComponent,
    details?: string,
    shieldProtected = false,
  ) => {
    const finalDelta = shieldProtected ? new Decimal(0) : unmultipliedDelta.times(multiplier);
    deltas.push({
      teamId,
      delta: finalDelta.toString(),
      component,
      details,
      shieldProtected,
    });
  };

  // 4. Clashing teams penalty
  const clashPenaltyMode = config.clashPenaltyMode ?? 'TWO_THIRDS_OF_PICK';
  const shieldCoversClash = config.shieldCoversClash ?? true;

  for (const clashing of clashRes.clashingPicks) {
    const teamId = clashing.teamId;
    const pick = clashing.pick;
    const protectedByShield = hasShield(teamId) && shieldCoversClash;

    let penalty = new Decimal(0);
    if (clashPenaltyMode === 'TWO_THIRDS_OF_PICK') {
      penalty = new Decimal(pick).times(2).dividedBy(3);
    } else {
      penalty = new Decimal(config.clashPenaltyX ?? 0);
    }

    addDelta(
      teamId,
      penalty.negated(),
      'CLASH_PENALTY',
      `Clashed on pick ${pick}`,
      protectedByShield,
    );

    teamSummaries[teamId] = {
      teamId,
      startScore: getStartScore(teamId).toString(),
      delta: protectedByShield ? '0' : penalty.negated().times(multiplier).toString(),
      finalScore: '', // computed at end
      pick,
      status: 'CLASH',
      cardPlayed: (teamCards.get(teamId) ?? [])[0]?.card,
      shieldProtected: protectedByShield,
      reason: protectedByShield
        ? `Clashed on pick ${pick} (Shield protected)`
        : `Clashed on pick ${pick}: penalty -${penalty.times(multiplier).toString()}`,
    };
  }

  // 5. Bucketing and scoring for valid picks (if not degenerate)
  const buckets =
    targetDecimal !== null
      ? bucketize(
          clashRes.validPicks,
          targetDecimal,
          config.equalityMode ?? 'EXACT',
          config.equalityEpsilon,
        )
      : { greater: [], equal: [], less: [] };

  let majorityBucket: 'GREATER' | 'LESS' | 'TIE' | 'EMPTY' = 'EMPTY';

  if (!isDegenerate && targetDecimal !== null) {
    // 5a. Equal-To bucket (always gets +pick, even under Reverse per OPEN-021.1)
    for (const item of buckets.equal) {
      const award = new Decimal(item.pick);
      addDelta(item.teamId, award, 'EXACT_MATCH_AWARD', `Matched target exactly with ${item.pick}`);

      teamSummaries[item.teamId] = {
        teamId: item.teamId,
        startScore: getStartScore(item.teamId).toString(),
        delta: award.times(multiplier).toString(),
        finalScore: '',
        pick: item.pick,
        status: 'VALID',
        bucket: 'EQUAL',
        cardPlayed: (teamCards.get(item.teamId) ?? [])[0]?.card,
        shieldProtected: false,
        reason: `Exact match with target: +${award.times(multiplier).toString()}`,
      };
    }

    // 5b. Greater vs Less
    const greaterCount = buckets.greater.length;
    const lessCount = buckets.less.length;

    if (greaterCount === lessCount) {
      majorityBucket = greaterCount === 0 ? 'EMPTY' : 'TIE';
      // Tie rule: both score 0 (OPEN-021.2)
      for (const item of [...buckets.greater, ...buckets.less]) {
        addDelta(item.teamId, new Decimal(0), 'TIE_ZERO', 'Tie between > and < buckets');
        const bucketType = item.pick > targetDecimal.toNumber() ? 'GREATER' : 'LESS';
        teamSummaries[item.teamId] = {
          teamId: item.teamId,
          startScore: getStartScore(item.teamId).toString(),
          delta: '0',
          finalScore: '',
          pick: item.pick,
          status: 'VALID',
          bucket: bucketType,
          cardPlayed: (teamCards.get(item.teamId) ?? [])[0]?.card,
          shieldProtected: false,
          reason: 'Tie between > and < buckets: 0 points',
        };
      }
    } else {
      const greaterIsMajority = greaterCount > lessCount;
      majorityBucket = greaterIsMajority ? 'GREATER' : 'LESS';

      const majorityItems = greaterIsMajority ? buckets.greater : buckets.less;
      const minorityItems = greaterIsMajority ? buckets.less : buckets.greater;
      const majorityClassification = greaterIsMajority ? 'GREATER' : 'LESS';
      const minorityClassification = greaterIsMajority ? 'LESS' : 'GREATER';

      const majorityPenaltyMode = config.majorityPenaltyMode ?? 'HALF_ABS_DISTANCE';
      const shieldCoversMajority = config.shieldCoversMajority ?? true;
      const shieldCoversReversedMinority = config.shieldCoversReversedMinority ?? true;

      // Relative distance magnitude: |Target - pick| / pick
      const calcRelativeDistance = (pick: number): Decimal =>
        targetDecimal.minus(pick).abs().dividedBy(pick);

      const calcDeduction = (pick: number): Decimal => {
        if (majorityPenaltyMode === 'FIXED_X') {
          return new Decimal(config.majorityPenaltyX ?? 0);
        }
        // HALF_ABS_DISTANCE (and other non-FIXED modes): |Target - pick| / pick
        return calcRelativeDistance(pick);
      };

      if (!isReversed) {
        // Normal mode: Minority wins |Target - pick| / pick, Majority loses |Target - pick| / pick
        for (const item of minorityItems) {
          const award = calcRelativeDistance(item.pick);
          addDelta(item.teamId, award, 'MINORITY_AWARD', `Minority bucket win with ${item.pick}`);
          teamSummaries[item.teamId] = {
            teamId: item.teamId,
            startScore: getStartScore(item.teamId).toString(),
            delta: award.times(multiplier).toString(),
            finalScore: '',
            pick: item.pick,
            status: 'VALID',
            bucket: minorityClassification,
            cardPlayed: (teamCards.get(item.teamId) ?? [])[0]?.card,
            shieldProtected: false,
            reason: `Minority win: +${award.times(multiplier).toString()}`,
          };
        }

        for (const item of majorityItems) {
          const deduction = calcDeduction(item.pick);
          const protectedByShield = hasShield(item.teamId) && shieldCoversMajority;
          addDelta(
            item.teamId,
            deduction.negated(),
            'MAJORITY_DEDUCTION',
            `Majority bucket deduction with ${item.pick}`,
            protectedByShield,
          );
          teamSummaries[item.teamId] = {
            teamId: item.teamId,
            startScore: getStartScore(item.teamId).toString(),
            delta: protectedByShield ? '0' : deduction.negated().times(multiplier).toString(),
            finalScore: '',
            pick: item.pick,
            status: 'VALID',
            bucket: majorityClassification,
            cardPlayed: (teamCards.get(item.teamId) ?? [])[0]?.card,
            shieldProtected: protectedByShield,
            reason: protectedByShield
              ? `Majority deduction protected by Shield`
              : `Majority deduction: -${deduction.times(multiplier).toString()}`,
          };
        }
      } else {
        // Reversed mode: Flipped majority wins |Target - pick| / pick,
        // Flipped minority loses |Target - pick| / pick
        for (const item of majorityItems) {
          const award = calcRelativeDistance(item.pick);
          addDelta(
            item.teamId,
            award,
            'REVERSED_MAJORITY_AWARD',
            `Reversed majority win with ${item.pick}`,
          );
          teamSummaries[item.teamId] = {
            teamId: item.teamId,
            startScore: getStartScore(item.teamId).toString(),
            delta: award.times(multiplier).toString(),
            finalScore: '',
            pick: item.pick,
            status: 'VALID',
            bucket: majorityClassification,
            cardPlayed: (teamCards.get(item.teamId) ?? [])[0]?.card,
            shieldProtected: false,
            reason: `Reversed majority win: +${award.times(multiplier).toString()}`,
          };
        }

        for (const item of minorityItems) {
          const deduction = calcDeduction(item.pick);
          const protectedByShield = hasShield(item.teamId) && shieldCoversReversedMinority;
          addDelta(
            item.teamId,
            deduction.negated(),
            'REVERSED_MINORITY_DEDUCTION',
            `Reversed minority deduction with ${item.pick}`,
            protectedByShield,
          );
          teamSummaries[item.teamId] = {
            teamId: item.teamId,
            startScore: getStartScore(item.teamId).toString(),
            delta: protectedByShield ? '0' : deduction.negated().times(multiplier).toString(),
            finalScore: '',
            pick: item.pick,
            status: 'VALID',
            bucket: minorityClassification,
            cardPlayed: (teamCards.get(item.teamId) ?? [])[0]?.card,
            shieldProtected: protectedByShield,
            reason: protectedByShield
              ? `Reversed minority deduction protected by Shield`
              : `Reversed minority deduction: -${deduction.times(multiplier).toString()}`,
          };
        }
      }
    }
  }

  // 6. No-pick penalties
  const shieldCoversNoPick = config.shieldCoversNoPick ?? false;

  for (const teamId of noPickTeams) {
    const startScore = getStartScore(teamId);
    let penalty = new Decimal(0);
    // Per OPEN-020: 1/10th of start-of-round score, max(0, startScore) / 10
    if (startScore.gt(0)) {
      penalty = startScore.dividedBy(10);
    }

    const protectedByShield = hasShield(teamId) && shieldCoversNoPick;
    addDelta(
      teamId,
      penalty.negated(),
      'NO_PICK_PENALTY',
      'Did not submit a pick',
      protectedByShield,
    );

    teamSummaries[teamId] = {
      teamId,
      startScore: startScore.toString(),
      delta: protectedByShield ? '0' : penalty.negated().times(multiplier).toString(),
      finalScore: '',
      status: 'NO_PICK',
      cardPlayed: (teamCards.get(teamId) ?? [])[0]?.card,
      shieldProtected: protectedByShield,
      reason: protectedByShield
        ? 'No pick submitted (Shield protected)'
        : penalty.gt(0)
          ? `No pick submitted: penalty -${penalty.times(multiplier).toString()} (1/10th)`
          : 'No pick submitted: 0 penalty (start score ≤ 0)',
    };
  }

  // 7. Calculate final scores for team summaries
  for (const teamId of allTeamIds) {
    const summary = teamSummaries[teamId];
    if (summary) {
      const start = new Decimal(summary.startScore);
      const delta = new Decimal(summary.delta);
      summary.finalScore = start.plus(delta).toString();
    }
  }

  return {
    statCard,
    target: targetStr,
    displayTarget,
    isDegenerate,
    validPicks: clashRes.validPicks,
    clashingPicks: clashRes.clashingPicks,
    noPickTeams,
    buckets,
    majorityBucket,
    reverseCount,
    isReversed,
    deltas,
    teamSummaries,
  };
}
