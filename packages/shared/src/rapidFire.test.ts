import { describe, expect, it } from 'vitest';
import {
  allocateRapidFireAwards,
  evaluateAnswer,
  normalizeAnswer,
  type RapidFireSubmissionCandidate,
} from './rapidFire.js';

describe('Rapid Fire Shared Logic', () => {
  describe('evaluateAnswer', () => {
    it('matches EXACT correctly', () => {
      expect(evaluateAnswer('Option A', 'Option A', 'EXACT')).toBe(true);
      expect(evaluateAnswer('option a', 'Option A', 'EXACT')).toBe(false);
      expect(evaluateAnswer('  Option A  ', 'Option A', 'EXACT')).toBe(true);
    });

    it('matches NORMALIZED correctly', () => {
      expect(normalizeAnswer('Hello, World! 123')).toBe('hello world 123');
      expect(evaluateAnswer('Hello, World!', 'hello world', 'NORMALIZED')).toBe(true);
      expect(evaluateAnswer('  paris.  ', 'Paris', 'NORMALIZED')).toBe(true);
      expect(evaluateAnswer('Rome', 'Paris', 'NORMALIZED')).toBe(false);
    });

    it('matches NUMERIC correctly', () => {
      expect(evaluateAnswer('42', '42', 'NUMERIC')).toBe(true);
      expect(evaluateAnswer('42.0', '42', 'NUMERIC')).toBe(true);
      expect(evaluateAnswer(' 0042 ', '42', 'NUMERIC')).toBe(true);
      expect(evaluateAnswer('43', '42', 'NUMERIC')).toBe(false);
      expect(evaluateAnswer('invalid', '42', 'NUMERIC')).toBe(false);
    });

    it('matches MCQ options correctly by option text, letter, or index', () => {
      const options = ['London', 'Berlin', 'Paris', 'Rome'];
      // Def is option text
      expect(evaluateAnswer('Paris', 'Paris', 'NORMALIZED', 'MCQ', options)).toBe(true);
      expect(evaluateAnswer('C', 'Paris', 'NORMALIZED', 'MCQ', options)).toBe(true);
      expect(evaluateAnswer('c', 'Paris', 'NORMALIZED', 'MCQ', options)).toBe(true);
      expect(evaluateAnswer('Berlin', 'Paris', 'NORMALIZED', 'MCQ', options)).toBe(false);
      expect(evaluateAnswer('A', 'Paris', 'NORMALIZED', 'MCQ', options)).toBe(false);

      // Def is letter
      expect(evaluateAnswer('Paris', 'C', 'NORMALIZED', 'MCQ', options)).toBe(true);
      expect(evaluateAnswer('C', 'C', 'NORMALIZED', 'MCQ', options)).toBe(true);
      expect(evaluateAnswer('London', 'C', 'NORMALIZED', 'MCQ', options)).toBe(false);
      expect(evaluateAnswer('A', 'C', 'NORMALIZED', 'MCQ', options)).toBe(false);
    });
  });

  describe('allocateRapidFireAwards', () => {
    const baseSubs: RapidFireSubmissionCandidate[] = [
      {
        id: 'sub-1',
        teamId: 'team-beta',
        receivedAt: '2026-10-15T10:00:02.000Z',
        isCorrect: true,
        attemptNumber: 1,
      },
      {
        id: 'sub-2',
        teamId: 'team-alpha',
        receivedAt: '2026-10-15T10:00:01.000Z',
        isCorrect: true,
        attemptNumber: 1,
      },
      {
        id: 'sub-3',
        teamId: 'team-gamma',
        receivedAt: '2026-10-15T10:00:00.500Z',
        isCorrect: false,
        attemptNumber: 1,
      },
      {
        id: 'sub-4',
        teamId: 'team-delta',
        receivedAt: '2026-10-15T10:00:03.000Z',
        isCorrect: true,
        attemptNumber: 1,
      },
    ];

    it('orders correct submissions by server timestamp and allocates topN', () => {
      const awards = allocateRapidFireAwards({
        submissions: baseSubs,
        topN: 2,
        mappedCard: 'SHIELD',
        availableSupply: 5,
        tieBreak: 'EARLIEST_RECEIVED_THEN_ID',
      });

      expect(awards).toHaveLength(2);
      expect(awards[0].teamId).toBe('team-alpha'); // 10:00:01
      expect(awards[0].rank).toBe(1);
      expect(awards[0].cardType).toBe('SHIELD');

      expect(awards[1].teamId).toBe('team-beta'); // 10:00:02
      expect(awards[1].rank).toBe(2);
    });

    it('respects availableSupply when smaller than topN', () => {
      const awards = allocateRapidFireAwards({
        submissions: baseSubs,
        topN: 3,
        mappedCard: 'REVERSE',
        availableSupply: 1,
        tieBreak: 'EARLIEST_RECEIVED_THEN_ID',
      });

      expect(awards).toHaveLength(1);
      expect(awards[0].teamId).toBe('team-alpha');
    });

    it('never over-awards RESERVE even if SHARE is selected', () => {
      const tiedSubs: RapidFireSubmissionCandidate[] = [
        {
          id: 's1',
          teamId: 'team-z',
          receivedAt: '2026-10-15T10:00:01.000Z',
          isCorrect: true,
          attemptNumber: 1,
        },
        {
          id: 's2',
          teamId: 'team-a',
          receivedAt: '2026-10-15T10:00:01.000Z',
          isCorrect: true,
          attemptNumber: 1,
        },
      ];

      const awards = allocateRapidFireAwards({
        submissions: tiedSubs,
        topN: 2,
        mappedCard: 'RESERVE',
        availableSupply: 1,
        tieBreak: 'SHARE',
      });

      expect(awards).toHaveLength(1);
      expect(awards[0].cardType).toBe('RESERVE');
      expect(awards[0].teamId).toBe('team-a'); // sorted deterministically by teamId
    });

    it('returns empty array if no correct submissions or mappedCard is null', () => {
      expect(
        allocateRapidFireAwards({
          submissions: [baseSubs[2]], // incorrect only
          topN: 1,
          mappedCard: 'PEEK',
          availableSupply: 2,
          tieBreak: 'EARLIEST_RECEIVED_THEN_ID',
        }),
      ).toEqual([]);

      expect(
        allocateRapidFireAwards({
          submissions: baseSubs,
          topN: 1,
          mappedCard: null,
          availableSupply: 2,
          tieBreak: 'EARLIEST_RECEIVED_THEN_ID',
        }),
      ).toEqual([]);
    });
  });
});
