import { useEffect, useState, type FormEvent } from 'react';
import type { RapidFireTeamView } from '@digiverse/shared';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  StatusPill,
  Timer,
} from '@/components';
import { getRapidFireCurrentApi, submitRapidFireAnswerApi } from '@/api/rapidFire';

export function RapidFirePage() {
  const [data, setData] = useState<RapidFireTeamView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function loadState() {
    try {
      const view = await getRapidFireCurrentApi();
      setData(view);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rapid fire state');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadState();
    const interval = setInterval(() => {
      void loadState();
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data?.question || !answer.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

    try {
      const res = await submitRapidFireAnswerApi(data.question.id, answer.trim());
      setSubmitMessage(
        res.isCorrect
          ? 'Answer recorded! Server evaluated your answer as correct.'
          : 'Answer recorded! Evaluated submission received.',
      );
      setAnswer('');
      await loadState();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState title="Connecting to Rapid Fire" />;
  if (error && !data) {
    return (
      <ErrorState
        title="Could not connect to Rapid Fire"
        description={error}
        actionLabel="Retry"
        onAction={() => {
          setLoading(true);
          void loadState();
        }}
      />
    );
  }

  const status = data?.status ?? 'IDLE';
  const question = data?.question;
  const submission = data?.teamSubmission;
  const award = data?.award;

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone={status === 'QUESTION_OPEN' ? 'red' : status === 'AWARDED' ? 'yellow' : 'blue'}>
            {status}
          </Badge>
          <h1 className="page-header__title">Rapid Fire — Game Phase A</h1>
          <p className="page-header__meta">
            Fastest correct answers earn power-up cards for the Main Game.
          </p>
        </div>
        <div className="row">
          <StatusPill
            status={
              status === 'QUESTION_OPEN'
                ? submission?.submitted
                  ? 'ok'
                  : 'live'
                : status === 'AWARDED'
                  ? 'done'
                  : 'waiting'
            }
            label={
              status === 'QUESTION_OPEN'
                ? submission?.submitted
                  ? 'Answer Submitted'
                  : 'Open'
                : status === 'CLOSED'
                  ? 'Submissions Closed'
                  : status === 'AWARDED'
                    ? 'Awards Finalized'
                    : 'Lobby'
            }
          />
          {status === 'QUESTION_OPEN' && question && (
            <Timer seconds={question.remainingSeconds} />
          )}
        </div>
      </header>

      {status === 'AWARDED' && award && (
        <Panel
          title={award.won ? 'Power-Up Award Won!' : 'Awards Completed'}
          accent={award.won ? 'yellow' : 'blue'}
        >
          {award.won ? (
            <div className="stack">
              <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
                Congratulations! Your team won a <strong>{award.cardType}</strong> card (Rank #{award.rank})!
              </p>
              <p>The power-up card has been deposited in your team inventory.</p>
            </div>
          ) : (
            <p>
              This question has concluded. Your team did not receive a card this round. Keep ready for the next question!
            </p>
          )}
        </Panel>
      )}

      {status === 'IDLE' && (
        <EmptyState
          title="Waiting for Question"
          description="The admin will launch the next Rapid Fire question shortly. Stay tuned!"
        />
      )}

      {status === 'CLOSED' && (
        <Panel title="Question Closed" accent="blue">
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>
            Submissions for this question are now closed. The admin is calculating rankings and allocating power-up cards.
          </p>
          {submission?.submitted && (
            <StatusPill status="ok" label="Your team submitted an answer" />
          )}
        </Panel>
      )}

      {(status === 'QUESTION_OPEN' || (status === 'CLOSED' && question)) && question && (
        <Panel accent="red" title="Current Question">
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            {question.mappedCard && (
              <Badge tone="yellow">Awards: {question.mappedCard}</Badge>
            )}
            <Badge tone="blue">Top {question.topN} Team(s)</Badge>
          </div>

          <p style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-fg)', marginBottom: 'var(--space-5)' }}>
            {question.prompt}
          </p>

          {submitMessage && (
            <p role="status" style={{ color: 'var(--color-success)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
              {submitMessage}
            </p>
          )}

          {submitError && (
            <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
              {submitError}
            </p>
          )}

          {submission?.canSubmit ? (
            <form className="stack" onSubmit={onSubmit}>
              <Input
                id="rf-answer"
                label="Your Answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                disabled={submitting}
                autoFocus
              />
              <div className="row">
                <Button type="submit" disabled={submitting || !answer.trim()}>
                  {submitting ? 'Submitting...' : 'Submit Answer'}
                </Button>
                {submission.attemptCount > 0 && (
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-muted)' }}>
                    Attempt {submission.attemptCount + 1} of {submission.maxAttempts}
                  </span>
                )}
              </div>
            </form>
          ) : (
            <div className="stack">
              <StatusPill
                status="ok"
                label={
                  submission?.submitted
                    ? 'Answer locked — maximum attempts reached'
                    : 'Submissions closed'
                }
              />
              {submission?.lastReceivedAt && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-muted)', marginTop: 'var(--space-2)' }}>
                  Submission received at: {new Date(submission.lastReceivedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
