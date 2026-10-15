import { describe, expect, it } from 'vitest';
import { formatScore } from './formatScore.js';

describe('formatScore', () => {
  it('formats numbers to exactly 4 decimal places', () => {
    expect(formatScore(12)).toBe('12.0000');
    expect(formatScore(12.3)).toBe('12.3000');
    expect(formatScore(12.34567)).toBe('12.3457');
    expect(formatScore(0)).toBe('0.0000');
  });

  it('formats decimal strings without premature intermediate rounding of the source', () => {
    // Input retains more precision than display; only the display output is rounded.
    expect(formatScore('12.3456789012')).toBe('12.3457');
    expect(formatScore('0.00004')).toBe('0.0000');
    expect(formatScore('0.00005')).toBe('0.0001');
    expect(formatScore('99.99995')).toBe('100.0000');
  });

  it('pads short fractional strings to 4 places', () => {
    expect(formatScore('1.2')).toBe('1.2000');
    expect(formatScore('1')).toBe('1.0000');
  });

  it('handles negative values', () => {
    expect(formatScore(-3.14159)).toBe('-3.1416');
    expect(formatScore('-0.00005')).toBe('-0.0001');
  });

  it('rejects invalid input', () => {
    expect(() => formatScore(Number.NaN)).toThrow(RangeError);
    expect(() => formatScore('not-a-number')).toThrow(TypeError);
    expect(() => formatScore('')).toThrow(TypeError);
  });
});
