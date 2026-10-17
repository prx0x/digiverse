import { describe, expect, it } from 'vitest';
import { bucketize } from './bucketing.js';
import { evaluatePeek, validateCardPlay } from './cards.js';
import { resolveClashes } from './clashes.js';
import { Decimal } from './decimal.js';
import { generateShuffledPalette } from './palette.js';
import { scoreRound } from './scoring.js';
import { assertValidTransition, canTransitionRound } from './stateMachine.js';
import { computeStatistic } from './statistics.js';
import type { TeamPick } from './types.js';

describe('packages/game-engine unit tests', () => {
  describe('Statistics calculation (computeStatistic)', () => {
    it('calculates MEAN accurately with no intermediate rounding', () => {
      expect(computeStatistic('MEAN', [10, 20, 30])?.toString()).toBe('20');
      expect(computeStatistic('MEAN', [1, 2])?.toString()).toBe('1.5');
      expect(computeStatistic('MEAN', [7])?.toString()).toBe('7');
      expect(computeStatistic('MEAN', [])).toBeNull();
    });

    it('calculates TWO_THIRDS accurately', () => {
      expect(computeStatistic('TWO_THIRDS', [90])?.toString()).toBe('60');
      // [10, 20, 30] -> mean 20 -> 2/3 * 20 = 40/3 = 13.3333...
      const res = computeStatistic('TWO_THIRDS', [10, 20, 30]);
      expect(res).not.toBeNull();
      expect(res!.toString().startsWith('13.3333333333333333333333333333333333333333333333333333333333')).toBe(true);
    });

    it('calculates MIDRANGE accurately', () => {
      expect(computeStatistic('MIDRANGE', [10, 25, 90])?.toString()).toBe('50');
      expect(computeStatistic('MIDRANGE', [42])?.toString()).toBe('42');
      expect(computeStatistic('MIDRANGE', [1, 100])?.toString()).toBe('50.5');
    });

    it('calculates MEAN_PLUS_SIGMA with population standard deviation (default)', () => {
      // [10, 20]: mean = 15. variance = ((10-15)^2 + (20-15)^2)/2 = (25 + 25)/2 = 25. sigma = 5. target = 20.
      expect(computeStatistic('MEAN_PLUS_SIGMA', [10, 20])?.toString()).toBe('20');

      // [2, 4, 4, 4, 5, 5, 7, 9]: mean = 5. variance = 32/8 = 4. sigma = 2. target = 7.
      expect(computeStatistic('MEAN_PLUS_SIGMA', [2, 4, 4, 4, 5, 5, 7, 9])?.toString()).toBe('7');
    });

    it('calculates MEAN_PLUS_SIGMA with sample standard deviation when configured', () => {
      // [10, 20]: mean = 15. sample variance = 50 / 1 = 50. sigma = sqrt(50) = 7.0710678... target = 15 + sqrt(50).
      const res = computeStatistic('MEAN_PLUS_SIGMA', [10, 20], { stdDevMode: 'SAMPLE' });
      expect(res).not.toBeNull();
      const expected = new Decimal(15).plus(new Decimal(50).sqrt());
      expect(res!.toString()).toBe(expected.toString());

      // Single item with sample stddev
      expect(computeStatistic('MEAN_PLUS_SIGMA', [10], { stdDevMode: 'SAMPLE', sampleStdDevForSingleValue: 'ZERO' })?.toString()).toBe('10');
      expect(computeStatistic('MEAN_PLUS_SIGMA', [10], { stdDevMode: 'SAMPLE', sampleStdDevForSingleValue: 'NO_TARGET' })).toBeNull();
    });

    it('calculates GEOMETRIC_MEAN accurately', () => {
      // [2, 8] -> sqrt(16) = 4
      const res1 = computeStatistic('GEOMETRIC_MEAN', [2, 8]);
      expect(res1).not.toBeNull();
      expect(res1!.toDecimalPlaces(10).toString()).toBe('4');

      // [1, 8, 64] -> cbrt(512) = 8
      const res2 = computeStatistic('GEOMETRIC_MEAN', [1, 8, 64]);
      expect(res2).not.toBeNull();
      expect(res2!.toDecimalPlaces(10).toString()).toBe('8');

      // Single pick
      const res3 = computeStatistic('GEOMETRIC_MEAN', [49]);
      expect(res3).not.toBeNull();
      expect(res3!.toDecimalPlaces(10).toString()).toBe('49');
    });
  });

  describe('Clash resolution (resolveClashes)', () => {
    it('handles rounds with no clashes', () => {
      const picks: TeamPick[] = [
        { teamId: 't1', pick: 10 },
        { teamId: 't2', pick: 20 },
        { teamId: 't3', pick: 30 },
      ];
      const res = resolveClashes(picks);
      expect(res.validPicks).toHaveLength(3);
      expect(res.clashingPicks).toHaveLength(0);
      expect(Object.keys(res.clashGroups)).toHaveLength(0);
    });

    it('handles pairwise clashes', () => {
      const picks: TeamPick[] = [
        { teamId: 't1', pick: 15 },
        { teamId: 't2', pick: 15 },
        { teamId: 't3', pick: 40 },
      ];
      const res = resolveClashes(picks);
      expect(res.validPicks).toEqual([{ teamId: 't3', pick: 40 }]);
      expect(res.clashingPicks).toEqual([
        { teamId: 't1', pick: 15 },
        { teamId: 't2', pick: 15 },
      ]);
      expect(res.clashGroups[15]).toEqual(['t1', 't2']);
    });

    it('handles multiple and 3-way clash groups', () => {
      const picks: TeamPick[] = [
        { teamId: 't1', pick: 20 },
        { teamId: 't2', pick: 20 },
        { teamId: 't3', pick: 20 },
        { teamId: 't4', pick: 50 },
        { teamId: 't5', pick: 50 },
        { teamId: 't6', pick: 75 },
      ];
      const res = resolveClashes(picks);
      expect(res.validPicks).toEqual([{ teamId: 't6', pick: 75 }]);
      expect(res.clashingPicks).toHaveLength(5);
      expect(res.clashGroups[20]).toEqual(['t1', 't2', 't3']);
      expect(res.clashGroups[50]).toEqual(['t4', 't5']);
    });

    it('handles all teams clashing (degenerate)', () => {
      const picks: TeamPick[] = [
        { teamId: 't1', pick: 10 },
        { teamId: 't2', pick: 10 },
      ];
      const res = resolveClashes(picks);
      expect(res.validPicks).toHaveLength(0);
      expect(res.clashingPicks).toHaveLength(2);
    });
  });

  describe('Bucketing (bucketize)', () => {
    it('classifies picks into greater, equal, and less', () => {
      const picks: TeamPick[] = [
        { teamId: 't1', pick: 10 },
        { teamId: 't2', pick: 25 },
        { teamId: 't3', pick: 50 },
      ];
      const buckets = bucketize(picks, new Decimal(25), 'EXACT');
      expect(buckets.less).toEqual([{ teamId: 't1', pick: 10 }]);
      expect(buckets.equal).toEqual([{ teamId: 't2', pick: 25 }]);
      expect(buckets.greater).toEqual([{ teamId: 't3', pick: 50 }]);
    });

    it('handles non-integer target where exact equality has no matches', () => {
      const picks: TeamPick[] = [
        { teamId: 't1', pick: 20 },
        { teamId: 't2', pick: 21 },
      ];
      const buckets = bucketize(picks, new Decimal('20.5'), 'EXACT');
      expect(buckets.less).toEqual([{ teamId: 't1', pick: 20 }]);
      expect(buckets.equal).toEqual([]);
      expect(buckets.greater).toEqual([{ teamId: 't2', pick: 21 }]);
    });
  });

  describe('Round scoring (scoreRound)', () => {
    it('scores normal round: minority wins |Target - pick| / pick, majority pays same', () => {
      // 3 teams: t1 picks 10, t2 picks 20, t3 picks 90.
      // Mean = (10 + 20 + 90)/3 = 120/3 = 40.
      // Target = 40.
      // Less bucket (<40): t1(10), t2(20) -> 2 teams (MAJORITY)
      // Greater bucket (>40): t3(90) -> 1 team (MINORITY)
      // Scoring:
      // t3 (minority): wins |40 - 90| / 90 = 50/90
      // t1 (majority): pays |40 - 10| / 10 = 3 deduction
      // t2 (majority): pays |40 - 20| / 20 = 1 deduction
      const res = scoreRound({
        statCard: 'MEAN',
        picks: [
          { teamId: 't1', pick: 10 },
          { teamId: 't2', pick: 20 },
          { teamId: 't3', pick: 90 },
        ],
        allTeamIds: ['t1', 't2', 't3'],
        currentScores: { t1: '100', t2: '100', t3: '100' },
      });

      expect(res.target).toBe('40');
      expect(res.displayTarget).toBe('40.0000');
      expect(res.majorityBucket).toBe('LESS');
      expect(res.isReversed).toBe(false);

      const minorityAward = '0.555555555555555555555555555555555555555555555555555555555556';
      expect(res.teamSummaries.t3.delta).toBe(minorityAward);
      expect(res.teamSummaries.t3.finalScore).toBe(
        '100.555555555555555555555555555555555555555555555555555555556',
      );

      expect(res.teamSummaries.t1.delta).toBe('-3');
      expect(res.teamSummaries.t1.finalScore).toBe('97');

      expect(res.teamSummaries.t2.delta).toBe('-1');
      expect(res.teamSummaries.t2.finalScore).toBe('99');
    });

    it('scores exact match: gets +pick', () => {
      // t1 picks 10, t2 picks 30, t3 picks 20.
      // Midrange: (10 + 30)/2 = 20.
      // t3 picked 20 = EXACT MATCH!
      // t1 (<20) = 1 team
      // t2 (>20) = 1 team
      // Equal > and < counts -> TIE! both score 0.
      // t3 gets +pick = +20.
      const res = scoreRound({
        statCard: 'MIDRANGE',
        picks: [
          { teamId: 't1', pick: 10 },
          { teamId: 't2', pick: 30 },
          { teamId: 't3', pick: 20 },
        ],
        allTeamIds: ['t1', 't2', 't3'],
        currentScores: { t1: '100', t2: '100', t3: '100' },
      });

      expect(res.target).toBe('20');
      expect(res.majorityBucket).toBe('TIE');
      expect(res.teamSummaries.t3.delta).toBe('20');
      expect(res.teamSummaries.t1.delta).toBe('0');
      expect(res.teamSummaries.t2.delta).toBe('0');
    });

    it('handles Reverse parity (0/1/2/3) and reversed scoring', () => {
      // Same picks as first test: t1(10), t2(20) [majority], t3(90) [minority].
      // Mean = 40.
      // 1 Reverse played:
      // Flipped majority (LESS: t1, t2) wins |Target - pick| / pick
      // t1 gets +3, t2 gets +1.
      // Flipped minority (GREATER: t3) pays |40 - 90|/90 = 50/90
      const res1 = scoreRound({
        statCard: 'MEAN',
        picks: [
          { teamId: 't1', pick: 10 },
          { teamId: 't2', pick: 20 },
          { teamId: 't3', pick: 90 },
        ],
        allTeamIds: ['t1', 't2', 't3'],
        currentScores: { t1: '100', t2: '100', t3: '100' },
        cardPlays: [{ teamId: 't1', card: 'REVERSE', phase: 'SELECTION' }],
      });

      expect(res1.reverseCount).toBe(1);
      expect(res1.isReversed).toBe(true);
      expect(res1.teamSummaries.t1.delta).toBe('3');
      expect(res1.teamSummaries.t2.delta).toBe('1');
      expect(res1.teamSummaries.t3.delta).toBe(
        '-0.555555555555555555555555555555555555555555555555555555555556',
      );

      // 2 Reverses played: even count => normal mode!
      const res2 = scoreRound({
        statCard: 'MEAN',
        picks: [
          { teamId: 't1', pick: 10 },
          { teamId: 't2', pick: 20 },
          { teamId: 't3', pick: 90 },
        ],
        allTeamIds: ['t1', 't2', 't3'],
        currentScores: { t1: '100', t2: '100', t3: '100' },
        cardPlays: [
          { teamId: 't1', card: 'REVERSE', phase: 'SELECTION' },
          { teamId: 't2', card: 'REVERSE', phase: 'SELECTION' },
        ],
      });
      expect(res2.reverseCount).toBe(2);
      expect(res2.isReversed).toBe(false);
      expect(res2.teamSummaries.t3.delta).toBe(
        '0.555555555555555555555555555555555555555555555555555555555556',
      ); // normal minority win
    });

    it('Shield nullifies clash penalty, majority deduction, and reversed minority deduction', () => {
      // Clashing test with Shield
      const resClash = scoreRound({
        statCard: 'MEAN',
        picks: [
          { teamId: 't1', pick: 30 },
          { teamId: 't2', pick: 30 },
        ],
        allTeamIds: ['t1', 't2'],
        currentScores: { t1: '100', t2: '100' },
        cardPlays: [{ teamId: 't1', card: 'SHIELD', phase: 'LOBBY' }],
      });
      // t1 shielded: delta 0
      expect(resClash.teamSummaries.t1.delta).toBe('0');
      expect(resClash.teamSummaries.t1.shieldProtected).toBe(true);
      // t2 unshielded: 2/3 * 30 = 20 deduction
      expect(resClash.teamSummaries.t2.delta).toBe('-20');
      expect(resClash.teamSummaries.t2.shieldProtected).toBe(false);
    });

    it('handles no-pick penalties: 1/10th of start score, 0 if score <= 0', () => {
      const res = scoreRound({
        statCard: 'MEAN',
        picks: [{ teamId: 't1', pick: 50 }],
        allTeamIds: ['t1', 't2', 't3'],
        currentScores: { t1: '100', t2: '80', t3: '-10' },
      });
      // t2 had 80 points: loses 8 points (1/10th)
      expect(res.teamSummaries.t2.delta).toBe('-8');
      expect(res.teamSummaries.t2.status).toBe('NO_PICK');
      // t3 had -10 points: loses 0 points
      expect(res.teamSummaries.t3.delta).toBe('0');
      expect(res.teamSummaries.t3.status).toBe('NO_PICK');
    });

    it('degenerate round: when all picks clash, no target is computed', () => {
      const res = scoreRound({
        statCard: 'MEAN',
        picks: [
          { teamId: 't1', pick: 45 },
          { teamId: 't2', pick: 45 },
        ],
        allTeamIds: ['t1', 't2'],
      });
      expect(res.isDegenerate).toBe(true);
      expect(res.target).toBeNull();
      expect(res.displayTarget).toBeNull();
      expect(res.clashingPicks).toHaveLength(2);
    });
  });

  describe('Palette generation (generateShuffledPalette)', () => {
    it('generates exactly numbers 1..100 with all numbers present and no duplicates', () => {
      const p1 = generateShuffledPalette('teamA-round1');
      expect(p1).toHaveLength(100);

      const set = new Set(p1);
      expect(set.size).toBe(100);
      for (let i = 1; i <= 100; i++) {
        expect(set.has(i)).toBe(true);
      }
    });

    it('is deterministic for the same seed, and produces different order for different seeds', () => {
      const p1a = generateShuffledPalette('seed-xyz');
      const p1b = generateShuffledPalette('seed-xyz');
      const p2 = generateShuffledPalette('seed-abc');

      expect(p1a).toEqual(p1b);
      expect(p1a).not.toEqual(p2);
    });
  });

  describe('Card rules and Peek evaluation', () => {
    it('enforces card play phases and single-card-per-round limit', () => {
      expect(validateCardPlay('SHIELD', 'LOBBY', 1, 0).valid).toBe(true);
      expect(validateCardPlay('SHIELD', 'SELECTION', 1, 0).valid).toBe(false);

      expect(validateCardPlay('RESERVE', 'LOBBY', 1, 0).valid).toBe(true);
      expect(validateCardPlay('RESERVE', 'SELECTION', 1, 0).valid).toBe(false);

      expect(validateCardPlay('PEEK', 'SELECTION', 1, 0).valid).toBe(true);
      expect(validateCardPlay('PEEK', 'LOBBY', 1, 0).valid).toBe(false);

      expect(validateCardPlay('REVERSE', 'SELECTION', 1, 0).valid).toBe(true);
      expect(validateCardPlay('REVERSE', 'LOBBY', 1, 0).valid).toBe(false);

      // Max 1 card per round
      expect(validateCardPlay('PEEK', 'SELECTION', 1, 1).valid).toBe(false);
      // Zero cards held
      expect(validateCardPlay('PEEK', 'SELECTION', 0, 0).valid).toBe(false);
    });

    it('evaluates Peek: count strictly < 50, excludes own pick, 50 excluded', () => {
      const picks: TeamPick[] = [
        { teamId: 't1', pick: 20 },
        { teamId: 't2', pick: 49 },
        { teamId: 't3', pick: 50 }, // 50 excluded per OPEN-013
        { teamId: 't4', pick: 80 },
        { teamId: 't-me', pick: 10 }, // own pick excluded
      ];

      const res = evaluatePeek(picks, 't-me');
      // t1(20) and t2(49) are strictly < 50 and not own pick: count = 2
      expect(res.count).toBe(2);
    });
  });

  describe('Round state machine (stateMachine)', () => {
    it('allows valid transitions', () => {
      expect(canTransitionRound('LOBBY', 'SELECTION')).toBe(true);
      expect(canTransitionRound('SELECTION', 'CLASH_RESOLUTION')).toBe(true);
      expect(canTransitionRound('CLASH_RESOLUTION', 'CALCULATION')).toBe(true);
      expect(canTransitionRound('CALCULATION', 'BUCKETING')).toBe(true);
      expect(canTransitionRound('BUCKETING', 'SCORING')).toBe(true);
      expect(canTransitionRound('SCORING', 'RESULT')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(canTransitionRound('LOBBY', 'RESULT')).toBe(false);
      expect(canTransitionRound('SELECTION', 'LOBBY')).toBe(false);
      expect(() => assertValidTransition('LOBBY', 'SCORING')).toThrow();
    });
  });
});
