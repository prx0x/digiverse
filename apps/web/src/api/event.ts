import type {
  EventStatus,
  MatchingMode,
  PowerUpCard,
  QuestionType,
  StatCard,
} from '@digiverse/shared';
import { fetchApi } from './client';

export type Readiness = {
  canMarkReady: boolean;
  issues: string[];
  gamePhaseBRulesComplete: boolean;
  unsetRuleFields: string[];
};

export type EventRecord = {
  id: string;
  name: string;
  status: EventStatus;
  gamePhaseARoundCount: number;
  gamePhaseBRoundCount: number;
  rapidFireDefaultTimeLimitSeconds: number;
  roundSelectionSeconds: number;
  statCardAnnouncementSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export type EventRulesRecord = {
  clashPenaltyMode: string | null;
  clashPenaltyX: string | null;
  majorityPenaltyMode: string | null;
  majorityPenaltyX: string | null;
  reversedMajorityReward: string | null;
  reverseAffectsEqualTo: boolean | null;
  reverseAffectsTiebreaker: boolean | null;
  reverseIsGlobal: boolean | null;
  shieldCoversClash: boolean | null;
  shieldCoversMajority: boolean | null;
  shieldCoversReversedMinority: boolean | null;
  shieldConsumedOnPlay: boolean | null;
  stdDevMode: string | null;
  sampleStdDevForSingleValue: string | null;
  degenerateRoundMode: string | null;
  equalityMode: string | null;
  equalityEpsilon: string | null;
  displayRounding: string | null;
  maxCardsPlayedPerRoundPerTeam: number | null;
  allowMultipleReversePerTeam: boolean | null;
  unusedCardsCarryForward: boolean | null;
  cardsConsumedEvenIfNoEffect: boolean | null;
  noPickBehaviour: string | null;
  allowPickChangeBeforeLock: boolean | null;
  preRoundCardsLobbyOnly: boolean | null;
  rapidFireTieBreak: string | null;
  rapidFireMaxAttempts: number | null;
  updatedAt: string;
};

export type QuestionRecord = {
  id: string;
  setId: string;
  prompt: string;
  answerDefinition: string;
  matchingMode: MatchingMode;
  timeLimitSeconds: number;
  mappedCard: PowerUpCard | null;
  topN: number;
  orderIndex: number;
  questionType?: QuestionType;
  options?: string[] | null;
};

export type QuestionSetRecord = {
  id: string;
  name: string;
  orderIndex: number;
  questions: QuestionRecord[];
};

export type RoundRecord = {
  id: string;
  gamePhase: 'A' | 'B';
  roundNumber: number;
  statCard: StatCard | null;
  timerSeconds: number;
};

export type EventBundle = {
  event: EventRecord;
  rules: EventRulesRecord;
  cardSupply: { cardType: PowerUpCard; maxSupply: number }[];
  rounds: RoundRecord[];
  questionSets: QuestionSetRecord[];
  readiness: Readiness;
};

export async function getAdminEventApi(): Promise<EventBundle> {
  return fetchApi<EventBundle>('/admin/event');
}

export async function putAdminEventApi(payload: Partial<EventRecord>): Promise<EventBundle> {
  return fetchApi<EventBundle>('/admin/event', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function postEventLifecycleApi(status: EventStatus): Promise<EventBundle> {
  return fetchApi<EventBundle>('/admin/event/lifecycle', {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function putEventRulesApi(payload: Partial<EventRulesRecord>): Promise<EventBundle> {
  return fetchApi<EventBundle>('/admin/event/rules', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function putCardSupplyApi(
  items: { cardType: PowerUpCard; maxSupply: number }[],
): Promise<EventBundle> {
  return fetchApi<EventBundle>('/admin/card-supply', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export async function putRoundsApi(
  rounds: { roundNumber: number; statCard: StatCard | null; timerSeconds: number }[],
): Promise<EventBundle> {
  return fetchApi<EventBundle>('/admin/rounds', {
    method: 'PUT',
    body: JSON.stringify({ rounds }),
  });
}

export async function createQuestionSetApi(name: string): Promise<EventBundle> {
  return fetchApi<EventBundle>('/admin/question-sets', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function patchQuestionSetApi(
  id: string,
  payload: { name?: string; orderIndex?: number },
): Promise<EventBundle> {
  return fetchApi<EventBundle>(`/admin/question-sets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteQuestionSetApi(id: string): Promise<EventBundle> {
  return fetchApi<EventBundle>(`/admin/question-sets/${id}`, { method: 'DELETE' });
}

export async function createQuestionApi(
  setId: string,
  payload: Omit<QuestionRecord, 'id' | 'setId' | 'orderIndex'>,
): Promise<EventBundle> {
  return fetchApi<EventBundle>(`/admin/question-sets/${setId}/questions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function patchQuestionApi(
  id: string,
  payload: Partial<Omit<QuestionRecord, 'id' | 'setId' | 'orderIndex'>>,
): Promise<EventBundle> {
  return fetchApi<EventBundle>(`/admin/questions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteQuestionApi(id: string): Promise<EventBundle> {
  return fetchApi<EventBundle>(`/admin/questions/${id}`, { method: 'DELETE' });
}
