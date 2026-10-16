import type {
  RapidFireAdminState,
  RapidFireTeamView,
  TeamCardItem,
} from '@digiverse/shared';
import { fetchApi } from './client.js';

export async function getRapidFireCurrentApi(): Promise<RapidFireTeamView> {
  return fetchApi<RapidFireTeamView>('/rapid-fire/current');
}

export async function submitRapidFireAnswerApi(
  questionId: string,
  answer: string,
): Promise<{ submitted: boolean; receivedAt: string; attemptNumber: number; isCorrect: boolean }> {
  return fetchApi('/rapid-fire/answers', {
    method: 'POST',
    body: JSON.stringify({ questionId, answer }),
  });
}

export async function getTeamCardsApi(): Promise<{ cards: TeamCardItem[] }> {
  return fetchApi<{ cards: TeamCardItem[] }>('/teams/me/cards');
}

export async function getAdminRapidFireStateApi(): Promise<RapidFireAdminState> {
  return fetchApi<RapidFireAdminState>('/admin/rapid-fire/state');
}

export async function startRapidFireQuestionApi(
  questionId: string,
): Promise<{ state: RapidFireAdminState }> {
  return fetchApi('/admin/rapid-fire/start', {
    method: 'POST',
    body: JSON.stringify({ questionId }),
  });
}

export async function closeRapidFireQuestionApi(
  sessionId?: string,
): Promise<{ state: RapidFireAdminState }> {
  return fetchApi('/admin/rapid-fire/close', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export async function awardRapidFireQuestionApi(
  sessionId?: string,
): Promise<{ state: RapidFireAdminState }> {
  return fetchApi('/admin/rapid-fire/award', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}
