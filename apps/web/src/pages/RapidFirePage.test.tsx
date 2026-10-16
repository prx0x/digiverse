import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RapidFirePage } from './RapidFirePage';
import * as rapidFireApi from '@/api/rapidFire';

afterEach(() => {
  cleanup();
});

vi.mock('@/api/rapidFire', () => ({
  getRapidFireCurrentApi: vi.fn(),
  submitRapidFireAnswerApi: vi.fn(),
}));

describe('RapidFirePage component', () => {
  it('renders question prompt, timer, and submits answer', async () => {
    vi.mocked(rapidFireApi.getRapidFireCurrentApi).mockResolvedValue({
      status: 'QUESTION_OPEN',
      question: {
        id: 'q-101',
        prompt: 'What is 7 * 8?',
        timeLimitSeconds: 20,
        openedAt: new Date().toISOString(),
        remainingSeconds: 15,
        mappedCard: 'SHIELD',
        topN: 2,
      },
      teamSubmission: {
        submitted: false,
        attemptCount: 0,
        maxAttempts: 1,
        canSubmit: true,
        lastReceivedAt: null,
      },
      award: null,
    });

    vi.mocked(rapidFireApi.submitRapidFireAnswerApi).mockResolvedValue({
      submitted: true,
      receivedAt: new Date().toISOString(),
      attemptNumber: 1,
      isCorrect: true,
    });

    render(
      <MemoryRouter>
        <RapidFirePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('What is 7 * 8?')).toBeInTheDocument();
    });

    expect(screen.getByText(/Awards: SHIELD/i)).toBeInTheDocument();
    expect(screen.getByText(/Top 2 Team\(s\)/i)).toBeInTheDocument();

    const input = screen.getByLabelText(/your answer/i);
    fireEvent.change(input, { target: { value: '56' } });

    const submitBtn = screen.getByRole('button', { name: /submit answer/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(rapidFireApi.submitRapidFireAnswerApi).toHaveBeenCalledWith('q-101', '56');
    });
  });

  it('renders award result when awarded', async () => {
    vi.mocked(rapidFireApi.getRapidFireCurrentApi).mockResolvedValue({
      status: 'AWARDED',
      question: {
        id: 'q-101',
        prompt: 'What is 7 * 8?',
        timeLimitSeconds: 20,
        openedAt: new Date().toISOString(),
        remainingSeconds: 0,
        mappedCard: 'SHIELD',
        topN: 2,
      },
      teamSubmission: {
        submitted: true,
        attemptCount: 1,
        maxAttempts: 1,
        canSubmit: false,
        lastReceivedAt: new Date().toISOString(),
      },
      award: {
        won: true,
        cardType: 'SHIELD',
        rank: 1,
      },
    });

    render(
      <MemoryRouter>
        <RapidFirePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Power-Up Award Won!/i)).toBeInTheDocument();
      expect(screen.getByText(/won a/i)).toBeInTheDocument();
      expect(screen.getByText(/SHIELD/i)).toBeInTheDocument();
    });
  });
});
