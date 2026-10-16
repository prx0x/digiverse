import type { PowerUpCard } from '@digiverse/shared';
import type { TeamPick } from './types.js';

export type CardPlayWindow = 'LOBBY' | 'SELECTION';

export const CARD_WINDOWS: Record<PowerUpCard, CardPlayWindow> = {
  SHIELD: 'LOBBY',
  RESERVE: 'LOBBY',
  PEEK: 'SELECTION',
  REVERSE: 'SELECTION',
};

export type CardPlayValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validates whether a team may play a power-up card.
 * Enforces:
 * - Allowed phase window (Shield/Reserve in Lobby; Peek/Reverse in Selection)
 * - Maximum 1 card played per team per round
 * - Sufficient inventory held
 */
export function validateCardPlay(
  card: PowerUpCard,
  currentPhase: CardPlayWindow,
  cardsHeld: number,
  cardsPlayedThisRound: number,
): CardPlayValidationResult {
  if (cardsHeld <= 0) {
    return { valid: false, error: `Team does not hold any ${card} cards.` };
  }

  if (cardsPlayedThisRound >= 1) {
    return { valid: false, error: 'Maximum 1 card may be played per round.' };
  }

  const allowedWindow = CARD_WINDOWS[card];
  if (currentPhase !== allowedWindow) {
    return {
      valid: false,
      error: `${card} can only be played during the ${allowedWindow} phase.`,
    };
  }

  return { valid: true };
}

/**
 * Evaluates Peek power-up card count.
 * Per OPEN-013:
 * - Strictly below 50 (picks < 50; 50 is excluded)
 * - Excludes own pick
 * - Snapshot of picks submitted at the moment of evaluation
 * - Returns count only
 */
export function evaluatePeek(
  submittedPicks: TeamPick[],
  ownTeamId: string,
): { count: number } {
  let count = 0;
  for (const item of submittedPicks) {
    if (item.teamId !== ownTeamId && item.pick < 50) {
      count++;
    }
  }
  return { count };
}
