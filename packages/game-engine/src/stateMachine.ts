import type { RoundState } from './types.js';

export const ROUND_TRANSITIONS: Record<RoundState, readonly RoundState[]> = {
  LOBBY: ['SELECTION', 'ABORTED'],
  SELECTION: ['CLASH_RESOLUTION', 'ABORTED'],
  CLASH_RESOLUTION: ['CALCULATION', 'ABORTED'],
  CALCULATION: ['BUCKETING', 'ABORTED'],
  BUCKETING: ['SCORING', 'ABORTED'],
  SCORING: ['RESULT', 'ABORTED'],
  RESULT: ['ABORTED'],
  ABORTED: [],
} as const;

export function canTransitionRound(current: RoundState, next: RoundState): boolean {
  const allowed = ROUND_TRANSITIONS[current] ?? [];
  return (allowed as readonly string[]).includes(next);
}

export function assertValidTransition(current: RoundState, next: RoundState): void {
  if (!canTransitionRound(current, next)) {
    throw new Error(`Invalid round state transition from ${current} to ${next}`);
  }
}
