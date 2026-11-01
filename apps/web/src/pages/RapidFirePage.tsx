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
import { useWebSocket } from '@/context';

export function RapidFirePage() {
  const [data, setData] = useState<RapidFireTeamView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const { subscribe } = useWebSocket();

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
    const tick = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    void loadState();

    const unsubs = [
      subscribe('rapidfire:opened', () => void loadState()),
      subscribe('rapidfire:closed', () => void loadState()),
      subscribe('rapidfire:awarded', () => void loadState()),
    ];

    const interval = setInterval(() => {
      void loadState();
    }, 3500);

    return () => {
      unsubs.forEach((unsub) => unsub());
      clearInterval(interval);
    };
  }, [subscribe]);

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
  const countdownSeconds = question?.openedAt
    ? Math.max(
        0,
        question.timeLimitSeconds -
          Math.floor(
            (clockNow - new Date(question.openedAt).getTime()) / 1000,
          ),
      )
    : (question?.remainingSeconds ?? 0);

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
            <Timer seconds={countdownSeconds} />
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

      {status === 'AWARDED' && question?.correctAnswer && (
        <Panel title="Correct Answer" accent="yellow">
          <div className="stack">
            <p
              style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 400,
              }}
            >
              {question.prompt}
            </p>

            <p
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 200,
                color: 'var(--color-success)',
              }}
            >
              {question.correctAnswer}
            </p>
          </div>
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
            {question.questionType === 'MCQ' && (
              <Badge tone="yellow">Multiple Choice</Badge>
            )}
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
              {question.questionType === 'MCQ' && question.options && question.options.length > 0 ? (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <label style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>
                    Select an Option:
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 'var(--space-3)',
                    }}
                  >
                    {question.options.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = answer === opt || answer.toUpperCase() === letter;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={submitting}
                          onClick={() => setAnswer(opt)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                            padding: 'var(--space-3) var(--space-4)',
                            border: isSelected
                              ? '3px solid var(--color-fg)'
                              : '2px solid var(--color-border)',
                            background: isSelected
                              ? 'var(--color-accent-yellow)'
                              : 'var(--color-surface)',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            textAlign: 'left',
                            boxShadow: isSelected ? '4px 4px 0 var(--color-fg)' : 'none',
                            transform: isSelected ? 'translate(-2px, -2px)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px',
                              background: isSelected ? 'var(--color-fg)' : 'var(--color-bg-subtle)',
                              color: isSelected ? 'var(--color-bg)' : 'var(--color-fg)',
                              fontWeight: 700,
                              fontSize: 'var(--font-size-md)',
                              border: '1px solid var(--color-border)',
                              flexShrink: 0,
                            }}
                          >
                            {letter}
                          </span>
                          <span
                            style={{
                              fontSize: 'var(--font-size-md)',
                              fontWeight: isSelected ? 700 : 500,
                              color: 'var(--color-fg)',
                            }}
                          >
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Input
                  id="rf-answer"
                  label="Your Answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  required
                  disabled={submitting}
                  autoFocus
                />
              )}
              <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                <Button type="submit" disabled={submitting || !answer.trim()}>
                  {submitting
                    ? 'Submitting...'
                    : question.questionType === 'MCQ' && answer
                      ? 'Submit Selection'
                      : 'Submit Answer'}
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
