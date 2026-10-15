import { describe, expect, it } from 'vitest';
import { shuffleNumbers } from './index';

describe('shuffleNumbers (MOCK)', () => {
  it('returns all integers 1–100 exactly once', () => {
    const nums = shuffleNumbers(42);
    expect(nums).toHaveLength(100);
    expect(new Set(nums).size).toBe(100);
    expect(Math.min(...nums)).toBe(1);
    expect(Math.max(...nums)).toBe(100);
  });

  it('produces different arrangements for different seeds', () => {
    const a = shuffleNumbers(1).join(',');
    const b = shuffleNumbers(2).join(',');
    expect(a).not.toBe(b);
  });
});
