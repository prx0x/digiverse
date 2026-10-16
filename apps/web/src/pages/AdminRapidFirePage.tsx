import { useEffect, useState } from 'react';
import type { RapidFireAdminState } from '@digiverse/shared';
import type { QuestionRecord } from '@/api/event';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  Select,
  StatusPill,
  Table,
} from '@/components';
import {
  awardRapidFireQuestionApi,
  closeRapidFireQuestionApi,
  getAdminRapidFireStateApi,
  startRapidFireQuestionApi,
} from '@/api/rapidFire';
import { useEventConfig } from '@/hooks/useEventConfig';

export function AdminRapidFirePage() {
  const { bundle, loading: bundleLoading, error: bundleError } = useEventConfig();
  const [state, setState] = useState<RapidFireAdminState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function loadAdminState() {
    try {
      const s = await getAdminRapidFireStateApi();
      setState(s);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rapid fire state');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminState();
    const interval = setInterval(() => {
      void loadAdminState();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (loading || bundleLoading) return <LoadingState title="Loading rapid fire control" />;
  if ((error || bundleError) && !state) {
    return (
      <ErrorState
        title="Could not load rapid fire control"
        description={error || bundleError || undefined}
        actionLabel="Retry"
        onAction={() => {
          setLoading(true);
          void loadAdminState();
        }}
      />
    );
  }

  const allQuestions: QuestionRecord[] = bundle?.questionSets.flatMap((s) => s.questions) ?? [];
  const currentStatus = state?.status ?? 'IDLE';
  const currentQ = state?.question;

  async function onStart() {
    const qId = selectedQuestionId || allQuestions[0]?.id;
    if (!qId) return;

    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await startRapidFireQuestionApi(qId);
      setState(res.state);
      setActionSuccess('Question launched! Submissions are now open.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to launch question');
    } finally {
      setBusy(false);
    }
  }

  async function onClose() {
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await closeRapidFireQuestionApi();
      setState(res.state);
      setActionSuccess('Question closed. No more submissions will be accepted.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to close question');
    } finally {
      setBusy(false);
    }
  }

  async function onAward() {
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await awardRapidFireQuestionApi();
      setState(res.state);
      setActionSuccess('Awards allocated successfully! Team inventories updated.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to allocate awards');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone={currentStatus === 'QUESTION_OPEN' ? 'red' : currentStatus === 'AWARDED' ? 'yellow' : 'blue'}>
            {currentStatus}
          </Badge>
          <h1 className="page-header__title">Rapid Fire Controller</h1>
          <p className="page-header__meta">
            Live orchestrator for Game Phase A questions, incoming submissions, and award distribution.
          </p>
        </div>
        <StatusPill
          status={currentStatus === 'QUESTION_OPEN' ? 'live' : currentStatus === 'AWARDED' ? 'ok' : 'waiting'}
          label={`Phase A: ${currentStatus}`}
        />
      </header>

      {actionSuccess && (
        <p role="status" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
          {actionSuccess}
        </p>
      )}

      {actionError && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
          {actionError}
        </p>
      )}

      {/* Card Supply Snapshot */}
      {state?.remainingCardSupply && (
        <Panel title="Card Supply Availability" accent="yellow">
          <div className="row" style={{ gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            {Object.entries(state.remainingCardSupply).map(([card, count]) => (
              <div key={card} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <strong>{card}:</strong>
                <Badge tone={(count as number) > 0 ? 'blue' : 'red'}>
                  {count as number} remaining
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Control Panel */}
      <Panel title="Session Controller" accent="blue">
        {currentStatus === 'IDLE' || currentStatus === 'AWARDED' ? (
          <div className="stack">
            {allQuestions.length === 0 ? (
              <EmptyState
                title="No Questions Configured"
                description="Add questions in the Questions & Sets section before launching Rapid Fire."
              />
            ) : (
              <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1 }}>
                  <Select
                    id="select-q"
                    label="Select Question to Launch"
                    value={selectedQuestionId || allQuestions[0]?.id}
                    onChange={(e) => setSelectedQuestionId(e.target.value)}
                    disabled={busy}
                  >
                    {allQuestions.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.prompt} (Card: {q.mappedCard ?? 'None'}, Top-{q.topN}, {q.timeLimitSeconds}s)
                      </option>
                    ))}
                  </Select>
                </div>
                <Button variant="primary" onClick={onStart} disabled={busy}>
                  {busy ? 'Launching...' : 'Launch Question'}
                </Button>
              </div>
            )}
          </div>
        ) : currentStatus === 'QUESTION_OPEN' ? (
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>
                Question is LIVE! Teams are currently submitting answers.
              </p>
              <p style={{ margin: 'var(--space-1) 0 0 0', color: 'var(--color-muted)' }}>
                Time limit: {currentQ?.timeLimitSeconds}s | Submissions received: {state?.submissions.length}
              </p>
            </div>
            <Button variant="danger" onClick={onClose} disabled={busy}>
              {busy ? 'Closing...' : 'Close Submissions Early'}
            </Button>
          </div>
        ) : currentStatus === 'CLOSED' ? (
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>
                Submissions are closed. Ready to evaluate and award power-up cards.
              </p>
              <p style={{ margin: 'var(--space-1) 0 0 0', color: 'var(--color-muted)' }}>
                Total submissions: {state?.submissions.length} | Correct answers: {state?.submissions.filter((s) => s.isCorrect).length}
              </p>
            </div>
            <Button variant="primary" onClick={onAward} disabled={busy}>
              {busy ? 'Calculating...' : 'Calculate & Award Power-Ups'}
            </Button>
          </div>
        ) : null}
      </Panel>

      {/* Active / Current Question Details */}
      {currentQ && (
        <Panel title="Active Question Details" accent="red">
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <Badge tone="yellow">Mapped Card: {currentQ.mappedCard ?? 'None'}</Badge>
            <Badge tone="blue">Top-{currentQ.topN} Winners</Badge>
            <Badge tone="black">Match: {currentQ.matchingMode}</Badge>
          </div>
          <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 'var(--space-2) 0' }}>
            {currentQ.prompt}
          </p>
          <p style={{ color: 'var(--color-muted)' }}>
            <strong>Correct Answer:</strong> {currentQ.answerDefinition}
          </p>
        </Panel>
      )}

      {/* Live Submissions Feed */}
      <Panel title={`Incoming Submissions (${state?.submissions.length ?? 0})`}>
        {(!state?.submissions || state.submissions.length === 0) ? (
          <EmptyState
            title="No Submissions Yet"
            description="Team submissions will appear here in real-time once teams respond."
          />
        ) : (
          <Table
            headers={['Team', 'Answer Given', 'Correct?', 'Attempt', 'Server Received At']}
            caption="Live Submissions"
          >
            {state.submissions.map((sub) => (
              <tr key={sub.id}>
                <td><strong>{sub.teamName}</strong></td>
                <td>{sub.rawAnswer}</td>
                <td>
                  <Badge tone={sub.isCorrect ? 'blue' : 'red'}>
                    {sub.isCorrect ? 'CORRECT' : 'INCORRECT'}
                  </Badge>
                </td>
                <td>#{sub.attemptNumber}</td>
                <td>{new Date(sub.receivedAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      {/* Awards Summary Table */}
      {state && state.awards.length > 0 && (
        <Panel title={`Award Distribution (${state.awards.length})`} accent="yellow">
          <Table
            headers={['Rank', 'Winning Team', 'Awarded Card', 'Received Time', 'Details']}
            caption="Allocated Awards"
          >
            {state.awards.map((a, idx) => (
              <tr key={idx}>
                <td><strong>#{a.rank}</strong></td>
                <td>{a.teamName}</td>
                <td>
                  <Badge tone="yellow">{a.cardType}</Badge>
                </td>
                <td>{new Date(a.receivedAt).toLocaleTimeString()}</td>
                <td>{a.reason}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
    </div>
  );
}
