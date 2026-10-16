import type { PowerUpCard, StatCard } from '@digiverse/shared';
import { fetchApi } from './client.js';

export type TeamRoundView = {
  active: boolean;
  round: {
    id: string;
    roundNumber: number;
    statCard: StatCard;
    status: 'LOBBY' | 'SELECTION' | 'CLASH_RESOLUTION' | 'CALCULATION' | 'BUCKETING' | 'SCORING' | 'RESULT' | 'ABORTED';
    lobbySeconds: number;
    selectionSeconds: number;
    lobbyStartedAt: string | null;
    selectionStartedAt: string | null;
    closedAt: string | null;
    isReversed: boolean;
    reverseCount: number;
    scoreMultiplier: number;
  } | null;
  myPick: { pick: number; isLocked: boolean } | null;
  myCardPlayed: {
    cardType: PowerUpCard;
    phase: string;
    metadata: Record<string, unknown> | null;
  } | null;
  myPalette: number[];
  reservedNumbers: number[];
  currentScore: string;
  inventory: Record<PowerUpCard, number>;
  result: {
    target: string | null;
    displayTarget: string | null;
    isDegenerate: boolean;
    isReversed: boolean;
    reverseCount: number;
    ledgerEntries: Array<{
      component: string;
      pointsDelta: string;
      balanceAfter: string;
      reason: string;
    }>;
    revealedPicks: Array<{
      teamId: string;
      teamName: string;
      pick: number;
    }>;
  } | null;
};

export type AdminRoundState = {
  active: boolean;
  round: {
    id: string;
    roundNumber: number;
    statCard: StatCard;
    status: string;
    lobbySeconds: number;
    selectionSeconds: number;
    lobbyStartedAt: string | null;
    selectionStartedAt: string | null;
    closedAt: string | null;
    targetValue: string | null;
    displayTarget: string | null;
    isDegenerate: boolean;
    isPractice: boolean;
    scoreMultiplier: number;
    reverseCount: number;
    isReversed: boolean;
  } | null;
  submissions: Array<{
    teamId: string;
    teamName: string;
    tag: string | null;
    pick: number | null;
    isLocked: boolean;
    isReservePick: boolean;
    receivedAt: string | null;
    cardPlayed: PowerUpCard | null;
    currentScore: string;
  }>;
};

export type LeaderboardEntry = {
  rank: number;
  teamId: string;
  name: string;
  tag: string | null;
  rawScore: string;
  displayScore: string;
  positiveRounds: number;
  cardsHeld: number;
};

export async function getRoundCurrentApi(): Promise<TeamRoundView> {
  return fetchApi<TeamRoundView>('/rounds/current');
}

export async function submitPickApi(pick: number): Promise<{ success: boolean; pick: unknown }> {
  return fetchApi('/rounds/current/pick', {
    method: 'POST',
    body: JSON.stringify({ pick }),
  });
}

export async function playCardApi(
  cardType: PowerUpCard,
  reservedNumber?: number,
): Promise<{ success: boolean; metadata?: Record<string, unknown> }> {
  return fetchApi('/rounds/current/cards/play', {
    method: 'POST',
    body: JSON.stringify({ cardType, reservedNumber }),
  });
}

export async function getLeaderboardApi(): Promise<{ leaderboard: LeaderboardEntry[] }> {
  return fetchApi<{ leaderboard: LeaderboardEntry[] }>('/leaderboard');
}

export async function getAdminRoundCurrentApi(): Promise<AdminRoundState> {
  return fetchApi<AdminRoundState>('/admin/rounds/current');
}

export async function startRoundApi(params: {
  roundNumber?: number;
  statCard?: StatCard;
  lobbySeconds?: number;
  selectionSeconds?: number;
  isPractice?: boolean;
  scoreMultiplier?: number;
}): Promise<{ round: unknown; state: AdminRoundState }> {
  return fetchApi('/admin/rounds/start', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function openSelectionApi(roundId: string): Promise<{ round: unknown; state: AdminRoundState }> {
  return fetchApi(`/admin/rounds/${roundId}/open-selection`, {
    method: 'POST',
  });
}

export async function resolveRoundApi(roundId: string): Promise<{ result: unknown; state: AdminRoundState }> {
  return fetchApi(`/admin/rounds/${roundId}/resolve`, {
    method: 'POST',
  });
}

export async function extendTimerApi(
  roundId: string,
  additionalSeconds: number,
): Promise<{ round: unknown }> {
  return fetchApi(`/admin/rounds/${roundId}/extend-timer`, {
    method: 'POST',
    body: JSON.stringify({ additionalSeconds }),
  });
}

export async function voidRoundApi(roundId: string, reason: string): Promise<{ success: boolean }> {
  return fetchApi(`/admin/rounds/${roundId}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
