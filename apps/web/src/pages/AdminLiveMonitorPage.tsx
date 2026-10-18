import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  ScoreDisplay,
  StatusPill,
  Table,
  Timer,
} from '@/components';
import {
  getAdminRoundCurrentApi,
  openSelectionApi,
  resolveRoundApi,
  extendTimerApi,
  startRoundApi,
  voidRoundApi,
  type AdminRoundState,
} from '@/api/rounds';
import { useWebSocket } from '@/context';

export function AdminLiveMonitorPage() {
  const [roundState, setRoundState] = useState<AdminRoundState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const { status: wsStatus, subscribe, latencyMs } = useWebSocket();

  async function loadState() {
    try {
      const res = await getAdminRoundCurrentApi();
      setRoundState(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live monitor');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadState();

    const unsubs = [
      subscribe('round:lobby', () => void loadState()),
      subscribe('round:selection_opened', () => void loadState()),
      subscribe('round:team_pick', () => void loadState()),
      subscribe('round:card_played', () => void loadState()),
      subscribe('round:result', () => void loadState()),
      subscribe('round:timer_extended', () => void loadState()),
      subscribe('round:voided', () => void loadState()),
      subscribe('leaderboard:update', () => void loadState()),
    ];

    const interval = setInterval(() => {
      void loadState();
    }, 4000);

    return () => {
      unsubs.forEach((unsub) => unsub());
      clearInterval(interval);
    };
  }, [subscribe]);

  async function handleOpenSelection(roundId: string) {
    setActionBusy(true);
    setActionNotice(null);
    try {
      await openSelectionApi(roundId);
      await loadState();
      setActionNotice('Selection opened for teams.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open selection');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleResolveRound(roundId: string) {
    if (!window.confirm('Resolve and score this round now?')) return;
    setActionBusy(true);
    setActionNotice(null);
    try {
      await resolveRoundApi(roundId);
      await loadState();
      setActionNotice('Round resolved and scored.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve round');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleExtendTimer(roundId: string, seconds: number) {
    setActionBusy(true);
    setActionNotice(null);
    try {
      await extendTimerApi(roundId, seconds);
      await loadState();
      setActionNotice(`Extended timer by ${seconds}s.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extend timer');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleVoidRound(roundId: string) {
    const reason = window.prompt('Enter reason for voiding this round:');
    if (!reason) return;
    setActionBusy(true);
    setActionNotice(null);
    try {
      await voidRoundApi(roundId, reason);
      await loadState();
      setActionNotice(`Round voided. Reason: ${reason}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to void round');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleStartNextRound() {
    setActionBusy(true);
    setActionNotice(null);
    try {
      const nextNum = activeRound ? activeRound.roundNumber + 1 : 1;
      await startRoundApi({ roundNumber: nextNum });
      await loadState();
      setActionNotice(`Round ${nextNum} started in Lobby.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start next round');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading && !roundState) {
    return <LoadingState title="Connecting to live monitor" />;
  }

  const activeRound = roundState?.round;
  const submissions = roundState?.submissions ?? [];
  const submittedCount = submissions.filter((s) => s.pick !== null).length;

  const timerSeconds =
    activeRound?.status === 'SELECTION'
      ? activeRound.selectionSeconds
      : activeRound?.status === 'LOBBY'
        ? activeRound.lobbySeconds
        : 0;

  return (
    <div className="stack">
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <Badge tone={activeRound ? 'red' : 'blue'}>
                {activeRound ? `ROUND ${activeRound.roundNumber}` : 'IDLE'}
              </Badge>
              <StatusPill
                status={wsStatus === 'connected' ? 'ok' : wsStatus === 'connecting' ? 'waiting' : 'error'}
                label={
                  wsStatus === 'connected'
                    ? `Live Sync${latencyMs !== null ? ` (${latencyMs}ms)` : ''}`
                    : wsStatus === 'connecting'
                      ? 'Reconnecting…'
                      : 'Disconnected (Polling)'
                }
              />
            </div>
            <h1 className="page-header__title">Live Admin Monitor</h1>
            <p className="page-header__meta">
              Real-time monitoring of round progression, team picks, cards, and submissions.
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <ErrorState
          title="Live Monitor Error"
          description={error}
          actionLabel="Retry"
          onAction={() => {
            setLoading(true);
            void loadState();
          }}
        />
      ) : null}

      {actionNotice ? (
        <div
          role="status"
          style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-bg-subtle, #f0f4f8)',
            borderLeft: '4px solid var(--color-brand-blue, #1a73e8)',
            fontWeight: 600,
          }}
        >
          {actionNotice}
        </div>
      ) : null}

      {activeRound && activeRound.status !== 'ABORTED' ? (
        <div className="stack">
          {/* Round Header / Status Card */}
          <Panel title={`Round ${activeRound.roundNumber} Status`} accent="red">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-3)',
              }}
            >
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>PHASE / STATUS</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-1)' }}>
                  <StatusPill
                    status={
                      activeRound.status === 'SELECTION'
                        ? 'live'
                        : activeRound.status === 'RESULT'
                          ? 'done'
                          : 'waiting'
                    }
                    label={activeRound.status}
                  />
                  {activeRound.isReversed ? (
                    <Badge tone="red">REVERSED ({activeRound.reverseCount})</Badge>
                  ) : null}
                  {activeRound.isPractice ? <Badge tone="yellow">PRACTICE</Badge> : null}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>STAT CARD</span>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', marginTop: 'var(--space-1)' }}>
                  {activeRound.statCard}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>SUBMISSIONS</span>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', marginTop: 'var(--space-1)' }}>
                  {submittedCount} / {submissions.length} teams
                </div>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>TIMER</span>
                <div style={{ marginTop: 'var(--space-1)' }}>
                  {timerSeconds > 0 ? (
                    <Timer
                      seconds={timerSeconds}
                      label={activeRound.status === 'SELECTION' ? 'Selection timer' : 'Lobby timer'}
                    />
                  ) : (
                    <span>No timer</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)' }}>
              {activeRound.status === 'LOBBY' ? (
                <Button disabled={actionBusy} onClick={() => handleOpenSelection(activeRound.id)}>
                  Open Selection Now
                </Button>
              ) : null}

              {activeRound.status === 'SELECTION' ? (
                <>
                  <Button
                    variant="danger"
                    disabled={actionBusy}
                    onClick={() => handleResolveRound(activeRound.id)}
                  >
                    Resolve & Score Round
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionBusy}
                    onClick={() => handleExtendTimer(activeRound.id, 30)}
                  >
                    +30s Timer
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionBusy}
                    onClick={() => handleExtendTimer(activeRound.id, 60)}
                  >
                    +60s Timer
                  </Button>
                </>
              ) : null}

              {activeRound.status === 'RESULT' ? (
                <Button
                  disabled={actionBusy}
                  onClick={handleStartNextRound}
                >
                  Start Round {activeRound.roundNumber + 1} (Lobby) →
                </Button>
              ) : null}

              <Button
                variant="ghost"
                disabled={actionBusy}
                onClick={() => handleVoidRound(activeRound.id)}
              >
                Void Round
              </Button>
            </div>
          </Panel>

          {/* Live Submissions Table */}
          <Panel title="Team Submissions Monitor" accent="blue">
            <Table
              headers={['Team', 'Pick', 'Status', 'Card Played', 'Score']}
              caption={`Live submissions for Round ${activeRound.roundNumber}`}
            >
              {submissions.map((s) => (
                <tr key={s.teamId}>
                  <td>
                    <strong>{s.teamName}</strong> {s.tag ? `(${s.tag})` : ''}
                  </td>
                  <td>
                    {s.pick !== null ? (
                      <Badge tone={s.isReservePick ? 'red' : 'yellow'}>
                        #{s.pick} {s.isReservePick ? '(Reserve)' : ''}
                      </Badge>
                    ) : (
                      <span style={{ color: 'var(--color-ink-muted)' }}>Pending</span>
                    )}
                  </td>
                  <td>
                    <StatusPill
                      status={s.isLocked ? 'done' : s.pick !== null ? 'waiting' : 'error'}
                      label={s.isLocked ? 'Locked' : s.pick !== null ? 'Uncommitted' : 'Awaiting Pick'}
                    />
                  </td>
                  <td>
                    {s.cardPlayed ? (
                      <Badge tone={s.cardPlayed === 'REVERSE' ? 'red' : s.cardPlayed === 'SHIELD' ? 'blue' : 'yellow'}>
                        {s.cardPlayed}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="table__score">
                    <ScoreDisplay value={s.currentScore} size="sm" label={`${s.teamName} score`} />
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
        </div>
      ) : (
        <EmptyState
          title="No Active Main Game Round"
          description="Go to Rounds & Stat Cards or start the round directly."
          actionLabel="Start Round 1 (Lobby)"
          onAction={handleStartNextRound}
        />
      )}
    </div>
  );
}
