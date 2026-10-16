import type { EqualityMode } from '@digiverse/shared';
import { Decimal } from './decimal.js';
import type { BucketedPicks, TeamPick } from './types.js';

/**
 * Classifies valid non-clashing picks into Greater, Equal, and Less than the statistical target.
 */
export function bucketize(
  validPicks: TeamPick[],
  target: Decimal,
  equalityMode: EqualityMode = 'EXACT',
  epsilon?: string | number,
): BucketedPicks {
  const greater: TeamPick[] = [];
  const equal: TeamPick[] = [];
  const less: TeamPick[] = [];

  const epsDecimal = epsilon !== undefined ? new Decimal(epsilon) : new Decimal('1e-9');

  for (const item of validPicks) {
    const pickDecimal = new Decimal(item.pick);

    let isEqualTo = false;

    if (equalityMode === 'EXACT') {
      isEqualTo = pickDecimal.equals(target);
    } else if (equalityMode === 'ROUND_TARGET_TO_INTEGER') {
      isEqualTo = pickDecimal.equals(target.round());
    } else if (equalityMode === 'EPSILON') {
      isEqualTo = pickDecimal.minus(target).abs().lte(epsDecimal);
    }

    if (isEqualTo) {
      equal.push(item);
    } else if (pickDecimal.gt(target)) {
      greater.push(item);
    } else {
      less.push(item);
    }
  }

  // Deterministic order
  greater.sort((a, b) => a.pick - b.pick || a.teamId.localeCompare(b.teamId));
  equal.sort((a, b) => a.pick - b.pick || a.teamId.localeCompare(b.teamId));
  less.sort((a, b) => a.pick - b.pick || a.teamId.localeCompare(b.teamId));

  return { greater, equal, less };
}
