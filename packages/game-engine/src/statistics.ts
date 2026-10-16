import type { StatCard, StdDevMode } from '@digiverse/shared';
import { Decimal } from './decimal.js';

export type StatisticOptions = {
  stdDevMode?: StdDevMode;
  sampleStdDevForSingleValue?: 'ZERO' | 'NO_TARGET';
};

/**
 * Computes the statistical target for a given stat card over valid non-clashing picks.
 * All computations are performed using arbitrary-precision decimals with no intermediate rounding.
 * Returns null if the round has no valid picks (degenerate).
 */
export function computeStatistic(
  card: StatCard,
  validPicks: number[],
  options: StatisticOptions = {},
): Decimal | null {
  if (validPicks.length === 0) {
    return null;
  }

  const n = new Decimal(validPicks.length);

  switch (card) {
    case 'MEAN': {
      const sum = validPicks.reduce((acc, val) => acc.plus(val), new Decimal(0));
      return sum.dividedBy(n);
    }

    case 'TWO_THIRDS': {
      const sum = validPicks.reduce((acc, val) => acc.plus(val), new Decimal(0));
      const mean = sum.dividedBy(n);
      return mean.times(2).dividedBy(3);
    }

    case 'MIDRANGE': {
      let min = validPicks[0];
      let max = validPicks[0];
      for (let i = 1; i < validPicks.length; i++) {
        if (validPicks[i] < min) min = validPicks[i];
        if (validPicks[i] > max) max = validPicks[i];
      }
      return new Decimal(min).plus(max).dividedBy(2);
    }

    case 'MEAN_PLUS_SIGMA': {
      const sum = validPicks.reduce((acc, val) => acc.plus(val), new Decimal(0));
      const mean = sum.dividedBy(n);

      const mode = options.stdDevMode ?? 'POPULATION';

      if (mode === 'SAMPLE') {
        if (validPicks.length === 1) {
          if (options.sampleStdDevForSingleValue === 'NO_TARGET') {
            return null;
          }
          return mean;
        }
        const divisor = new Decimal(validPicks.length - 1);
        const sumSquaredDiffs = validPicks.reduce(
          (acc, val) => acc.plus(new Decimal(val).minus(mean).pow(2)),
          new Decimal(0),
        );
        const variance = sumSquaredDiffs.dividedBy(divisor);
        const sigma = variance.sqrt();
        return mean.plus(sigma);
      }

      // Default: POPULATION (divide by N per OPEN-015)
      const sumSquaredDiffs = validPicks.reduce(
        (acc, val) => acc.plus(new Decimal(val).minus(mean).pow(2)),
        new Decimal(0),
      );
      const variance = sumSquaredDiffs.dividedBy(n);
      const sigma = variance.sqrt();
      return mean.plus(sigma);
    }

    case 'GEOMETRIC_MEAN': {
      // (product of x_i) ^ (1/N) = exp( (sum of ln(x_i)) / N )
      let lnSum = new Decimal(0);
      for (const val of validPicks) {
        if (val <= 0) {
          throw new Error(`Geometric mean requires positive numbers, received ${val}`);
        }
        lnSum = lnSum.plus(new Decimal(val).ln());
      }
      return lnSum.dividedBy(n).exp();
    }

    default: {
      const _exhaustiveCheck: never = card;
      throw new Error(`Unhandled stat card: ${_exhaustiveCheck}`);
    }
  }
}
