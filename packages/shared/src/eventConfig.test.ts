import { describe, expect, it } from 'vitest';
import {
  defaultCardSupply,
  isNonNegativeDecimalString,
  validateAwardedVsSupply,
  validateCardSupplyMap,
} from './eventConfig.js';

describe('event config validation', () => {
  it('requires Reserve max supply of exactly 1', () => {
    const supply = defaultCardSupply();
    expect(validateCardSupplyMap(supply)).toEqual([]);
    expect(validateCardSupplyMap({ ...supply, RESERVE: 2 })).toContain(
      'Reserve max supply must be exactly 1 (official rulebook)',
    );
    expect(validateCardSupplyMap({ ...supply, RESERVE: 0 })).toContain(
      'Reserve max supply must be exactly 1 (official rulebook)',
    );
  });

  it('rejects a second Reserve mapping via top-N totals', () => {
    const supply = defaultCardSupply();
    const issues = validateAwardedVsSupply(
      [
        { card: 'RESERVE', topN: 1 },
        { card: 'RESERVE', topN: 1 },
      ],
      supply,
    );
    expect(issues.some((i) => i.includes('RESERVE'))).toBe(true);
  });

  it('rejects top-N < 1', () => {
    const issues = validateAwardedVsSupply([{ card: 'SHIELD', topN: 0 }], {
      ...defaultCardSupply(),
      SHIELD: 4,
    });
    expect(issues.some((i) => i.includes('top-N'))).toBe(true);
  });

  it('rejects unknown-scale negative decimal strings', () => {
    expect(isNonNegativeDecimalString('0')).toBe(true);
    expect(isNonNegativeDecimalString('12.5')).toBe(true);
    expect(isNonNegativeDecimalString('-1')).toBe(false);
    expect(isNonNegativeDecimalString('abc')).toBe(false);
  });
});
