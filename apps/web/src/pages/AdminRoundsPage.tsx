import { useEffect, useState, type FormEvent } from 'react';
import { STAT_CARDS, type StatCard } from '@digiverse/shared';
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
  StatusPill,
  Table,
} from '@/components';
import { putAdminEventApi, putRoundsApi } from '@/api/event';
import {
  extendTimerApi,
  getAdminRoundCurrentApi,
  openSelectionApi,
  resolveRoundApi,
  startRoundApi,
  voidRoundApi,
  type AdminRoundState,
} from '@/api/rounds';
import { formatApiError, useEventConfig } from '@/hooks/useEventConfig';
import { useWebSocket } from '@/context';

export function AdminRoundsPage() {
  const { bundle, setBundle, loading, error, locked, refresh } = useEventConfig();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { subscribe } = useWebSocket();

  // Live round controller state
  const [liveRound, setLiveRound] = useState<AdminRoundState | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Start round form state
  const [selectedStatCard, setSelectedStatCard] = useState<StatCard>('MEAN');
  const [customLobbySecs, setCustomLobbySecs] = useState(15);
  const [customSelectionSecs, setCustomSelectionSecs] = useState(60);
  const [isPractice, setIsPractice] = useState(false);
  const [scoreMultiplier, setScoreMultiplier] = useState(1);

  async function loadLiveRound() {
    try {
      const res = await getAdminRoundCurrentApi();
      setLiveRound(res);
      setLiveError(null);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to load live round');
    } finally {
      setLiveLoading(false);
    }
  }

  useEffect(() => {
    void loadLiveRound();

    const unsubs = [
      subscribe('round:lobby', () => void loadLiveRound()),
      subscribe('round:selection_opened', () => void loadLiveRound()),
      subscribe('round:team_pick', () => void loadLiveRound()),
      subscribe('round:card_played', () => void loadLiveRound()),
      subscribe('round:result', () => void loadLiveRound()),
      subscribe('round:timer_extended', () => void loadLiveRound()),
      subscribe('round:voided', () => void loadLiveRound()),
    ];

    const interval = setInterval(() => {
      void loadLiveRound();
    }, 3000);

    return () => {
      unsubs.forEach((unsub) => unsub());
      clearInterval(interval);
    };
  }, [subscribe]);

  const activeRound = liveRound?.active && liveRound.round ? liveRound.round : null;
  const nextRoundNumber = activeRound
    ? activeRound.status === 'RESULT' || activeRound.status === 'ABORTED'
      ? activeRound.roundNumber + 1
      : activeRound.roundNumber
    : 1;

  useEffect(() => {
    if (!bundle) return;
    const cfg = bundle.rounds.find(
      (r) => r.gamePhase === 'B' && r.roundNumber === nextRoundNumber,
    );
    if (cfg?.statCard) {
      setSelectedStatCard(cfg.statCard);
    }
    if (cfg?.timerSeconds) {
      setCustomSelectionSecs(cfg.timerSeconds);
    }
  }, [nextRoundNumber, bundle]);

  if (loading) return <LoadingState title="Loading rounds" />;
  if (error || !bundle) {
    return (
      <ErrorState
        title="Could not load rounds"
        description={error ?? undefined}
        actionLabel="Retry"
        onAction={() => void refresh()}
      />
    );
  }

  const phaseB = bundle.rounds.filter((r) => r.gamePhase === 'B');

  async function onCounts(e: FormEvent) {
    e.preventDefault();
    if (!bundle) return;
    setFormError(null);
    try {
      const next = await putAdminEventApi({
        gamePhaseARoundCount: bundle.event.gamePhaseARoundCount,
        gamePhaseBRoundCount: bundle.event.gamePhaseBRoundCount,
        roundSelectionSeconds: bundle.event.roundSelectionSeconds,
        statCardAnnouncementSeconds: bundle.event.statCardAnnouncementSeconds,
        rapidFireDefaultTimeLimitSeconds: bundle.event.rapidFireDefaultTimeLimitSeconds,
      });
      setBundle(next);
      setNotice('Round counts and default timers saved.');
    } catch (err) {
      setFormError(formatApiError(err));
    }
  }

  async function onSaveRounds(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const next = await putRoundsApi(
        phaseB.map((r) => ({
          roundNumber: r.roundNumber,
          statCard: r.statCard,
          timerSeconds: r.timerSeconds,
        })),
      );
      setBundle(next);
      setNotice('Game Phase B rounds saved.');
    } catch (err) {
      setFormError(formatApiError(err));
    }
  }

  async function handleStartRound(overrideConfig?: {
    roundNumber?: number;
    statCard?: StatCard;
    lobbySeconds?: number;
    selectionSeconds?: number;
    isPractice?: boolean;
    scoreMultiplier?: number;
  }) {
    setActionBusy(true);
    setLiveError(null);
    try {
      const targetRoundNum = overrideConfig?.roundNumber ?? nextRoundNumber;
      await startRoundApi({
        roundNumber: targetRoundNum,
        statCard: overrideConfig?.statCard ?? selectedStatCard,
        lobbySeconds: overrideConfig?.lobbySeconds ?? customLobbySecs,
        selectionSeconds: overrideConfig?.selectionSeconds ?? customSelectionSecs,
        isPractice: overrideConfig?.isPractice ?? isPractice,
        scoreMultiplier: overrideConfig?.scoreMultiplier ?? scoreMultiplier,
      });
      await loadLiveRound();
      setNotice(`Round ${targetRoundNum} started in Lobby.`);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to start round');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleOpenSelection(roundId: string) {
    setActionBusy(true);
    try {
      await openSelectionApi(roundId);
      await loadLiveRound();
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to open selection');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleResolveRound(roundId: string) {
    setActionBusy(true);
    try {
      await resolveRoundApi(roundId);
      await loadLiveRound();
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to resolve round');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleExtendTimer(roundId: string) {
    setActionBusy(true);
    try {
      await extendTimerApi(roundId, 30);
      await loadLiveRound();
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to extend timer');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleVoidRound(roundId: string) {
    const reason = window.prompt('Enter reason for voiding this round:');
    if (!reason) return;
    setActionBusy(true);
    try {
      await voidRoundApi(roundId, reason);
      await loadLiveRound();
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to void round');
    } finally {
      setActionBusy(false);
    }
  }

  const isRoundUnderway =
    activeRound && (activeRound.status === 'LOBBY' || activeRound.status === 'SELECTION');
  const isRoundCompleted = activeRound && activeRound.status === 'RESULT';
  const nextRoundConfig = phaseB.find((r) => r.roundNumber === nextRoundNumber);
  const totalPhaseBRounds = bundle.event.gamePhaseBRoundCount;
  const isPhaseBComplete =
    isRoundCompleted && activeRound.roundNumber >= totalPhaseBRounds;

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="blue">{bundle.event.status}</Badge>
          <h1 className="page-header__title">Game Phase B — Main Game Control</h1>
          <p className="page-header__meta">
            Live round controller, live submissions, and round configuration.
          </p>
        </div>
      </header>

      {formError ? (
        <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
          {formError}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}

      {/* Live Round Controller Panel */}
      <Panel title="Live Round Controller" accent="yellow">
        {liveError ? (
          <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
            {liveError}
          </p>
        ) : null}

        {activeRound && activeRound.status !== 'ABORTED' ? (
          <div className="stack">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>
                  Round {activeRound.roundNumber} ({activeRound.statCard})
                </h2>
                <p>
                  Status:{' '}
                  <StatusPill
                    status={
                      activeRound.status === 'RESULT'
                        ? 'done'
                        : activeRound.status === 'SELECTION'
                          ? 'live'
                          : 'waiting'
                    }
                    label={activeRound.status}
                  />{' '}
                  {activeRound.isReversed ? (
                    <Badge tone="red">REVERSED ({activeRound.reverseCount})</Badge>
                  ) : null}{' '}
                  {activeRound.isPractice ? <Badge tone="yellow">PRACTICE</Badge> : null}
                </p>
                {activeRound.displayTarget ? (
                  <p>
                    <strong>Target:</strong> {activeRound.displayTarget}
                  </p>
                ) : null}
              </div>

              <div className="row">
                {activeRound.status === 'LOBBY' ? (
                  <Button
                    disabled={actionBusy}
                    onClick={() => handleOpenSelection(activeRound.id)}
                  >
                    Open Selection
                  </Button>
                ) : null}

                {activeRound.status === 'SELECTION' ? (
                  <Button
                    variant="danger"
                    disabled={actionBusy}
                    onClick={() => handleResolveRound(activeRound.id)}
                  >
                    Resolve & Score Round
                  </Button>
                ) : null}

                {activeRound.status === 'LOBBY' || activeRound.status === 'SELECTION' ? (
                  <Button
                    variant="secondary"
                    disabled={actionBusy}
                    onClick={() => handleExtendTimer(activeRound.id)}
                  >
                    +30s Timer
                  </Button>
                ) : null}

                {activeRound.status === 'RESULT' ? (
                  <Button
                    disabled={actionBusy || liveLoading}
                    onClick={() => handleStartRound()}
                  >
                    Start Round {nextRoundNumber} (Lobby) →
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
            </div>

            {/* Live Submissions Table */}
            <div>
              <h3>Team Submissions & Picks (Live Admin View)</h3>
              {liveRound?.submissions && liveRound.submissions.length > 0 ? (
                <Table
                  headers={['Team', 'Pick', 'Status', 'Card Played', 'Current Score']}
                  caption="Live Submissions"
                >
                  {liveRound.submissions.map((s) => (
                    <tr key={s.teamId}>
                      <td>
                        <strong>{s.teamName}</strong> {s.tag ? `(${s.tag})` : ''}
                      </td>
                      <td>
                        {s.pick !== null ? (
                          <Badge tone="yellow">
                            #{s.pick} {s.isReservePick ? '(Reserve)' : ''}
                          </Badge>
                        ) : (
                          <span style={{ color: 'var(--color-muted)' }}>Pending</span>
                        )}
                      </td>
                      <td>
                        <StatusPill
                          status={s.isLocked ? 'done' : 'waiting'}
                          label={s.isLocked ? 'Locked' : 'Uncommitted'}
                        />
                      </td>
                      <td>{s.cardPlayed ? <Badge tone="blue">{s.cardPlayed}</Badge> : '—'}</td>
                      <td>{s.currentScore}</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <p>No teams in event.</p>
              )}
            </div>
          </div>
        ) : null}

        {!isRoundUnderway && (
          <div
            className="stack"
            style={{
              marginTop: activeRound && activeRound.status !== 'ABORTED' ? 'var(--space-4)' : 0,
              paddingTop: activeRound && activeRound.status !== 'ABORTED' ? 'var(--space-4)' : 0,
              borderTop:
                activeRound && activeRound.status !== 'ABORTED'
                  ? '1px solid var(--color-border)'
                  : 'none',
            }}
          >
            {isPhaseBComplete ? (
              <div
                style={{
                  padding: 'var(--space-3)',
                  background: 'var(--color-bg-subtle, #f0f4f8)',
                  borderRadius: '4px',
                  borderLeft: '4px solid var(--color-brand-blue, #1a73e8)',
                }}
              >
                <h3 style={{ margin: '0 0 var(--space-1) 0' }}>
                  All {totalPhaseBRounds} Phase B Rounds Completed
                </h3>
                <p style={{ margin: '0 0 var(--space-2) 0' }}>
                  All scheduled main game rounds are complete. You can view the final leaderboard or
                  start an additional tiebreaker round below if required.
                </p>
              </div>
            ) : null}

            <div>
              <h3>
                {activeRound && activeRound.status !== 'ABORTED'
                  ? `Start Round ${nextRoundNumber} of ${totalPhaseBRounds} (Lobby)`
                  : 'Start Round 1 (Lobby)'}
              </h3>
              <p style={{ color: 'var(--color-ink-muted)', margin: '0 0 var(--space-3) 0' }}>
                {nextRoundConfig?.statCard
                  ? `Pre-configured Stat Card: ${nextRoundConfig.statCard}. Configure parameters or start immediately.`
                  : 'Select stat card and timers to start the next round.'}
              </p>
            </div>

            <div className="form-grid">
              <Select
                id="stat-card-select"
                label="Stat Card"
                value={selectedStatCard}
                onChange={(e) => setSelectedStatCard(e.target.value as StatCard)}
              >
                {STAT_CARDS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Input
                id="lobby-secs"
                label="Lobby Timer (s)"
                type="number"
                min={5}
                value={customLobbySecs}
                onChange={(e) => setCustomLobbySecs(Number(e.target.value))}
              />
              <Input
                id="selection-secs"
                label="Selection Timer (s)"
                type="number"
                min={10}
                value={customSelectionSecs}
                onChange={(e) => setCustomSelectionSecs(Number(e.target.value))}
              />
              <Input
                id="multiplier"
                label="Score Multiplier"
                type="number"
                min={1}
                max={10}
                value={scoreMultiplier}
                onChange={(e) => setScoreMultiplier(Number(e.target.value))}
              />
            </div>
            <div className="row" style={{ alignItems: 'center' }}>
              <label className="row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
                <input
                  type="checkbox"
                  checked={isPractice}
                  onChange={(e) => setIsPractice(e.target.checked)}
                />
                Practice Round (Scores uncommitted)
              </label>
            </div>
            <div className="row">
              <Button disabled={actionBusy || liveLoading} onClick={() => handleStartRound()}>
                {`Start Round ${nextRoundNumber} (Lobby)`}
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Configuration Panels */}
      <Panel title="Counts & default timers" accent="blue">
        <form className="stack" onSubmit={onCounts}>
          <div className="form-grid">
            <Input
              id="phase-a-count"
              label="Game Phase A rounds"
              type="number"
              min={1}
              disabled={locked}
              value={bundle.event.gamePhaseARoundCount}
              onChange={(e) =>
                setBundle({
                  ...bundle,
                  event: { ...bundle.event, gamePhaseARoundCount: Number(e.target.value) },
                })
              }
            />
            <Input
              id="phase-b-count"
              label="Game Phase B rounds"
              type="number"
              min={1}
              disabled={locked}
              value={bundle.event.gamePhaseBRoundCount}
              onChange={(e) =>
                setBundle({
                  ...bundle,
                  event: { ...bundle.event, gamePhaseBRoundCount: Number(e.target.value) },
                })
              }
            />
            <Input
              id="round-selection-seconds"
              label="Selection duration (s)"
              type="number"
              min={1}
              disabled={locked}
              value={bundle.event.roundSelectionSeconds}
              onChange={(e) =>
                setBundle({
                  ...bundle,
                  event: { ...bundle.event, roundSelectionSeconds: Number(e.target.value) },
                })
              }
            />
            <Input
              id="announcement-seconds"
              label="Announcement duration (s)"
              type="number"
              min={0}
              disabled={locked}
              value={bundle.event.statCardAnnouncementSeconds}
              onChange={(e) =>
                setBundle({
                  ...bundle,
                  event: { ...bundle.event, statCardAnnouncementSeconds: Number(e.target.value) },
                })
              }
            />
          </div>
          <Button type="submit" disabled={locked}>
            Save counts & timers
          </Button>
        </form>
      </Panel>

      <Panel title="Game Phase B — stat card per round">
        <form className="stack" onSubmit={onSaveRounds}>
          {phaseB.map((round) => (
            <div key={round.id} className="form-grid">
              <Select
                id={`stat-${round.id}`}
                label={`Round ${round.roundNumber} stat card`}
                disabled={locked}
                value={round.statCard ?? ''}
                onChange={(e) => {
                  const statCard = (e.target.value || null) as StatCard | null;
                  const rounds = bundle.rounds.map((r) =>
                    r.id === round.id ? { ...r, statCard } : r,
                  );
                  setBundle({ ...bundle, rounds });
                }}
              >
                <option value="">Unset</option>
                {STAT_CARDS.map((card) => (
                  <option key={card} value={card}>
                    {card}
                  </option>
                ))}
              </Select>
              <Input
                id={`timer-${round.id}`}
                label={`Round ${round.roundNumber} timer (s)`}
                type="number"
                min={1}
                disabled={locked}
                value={round.timerSeconds}
                onChange={(e) => {
                  const timerSeconds = Number(e.target.value);
                  setBundle({
                    ...bundle,
                    rounds: bundle.rounds.map((r) =>
                      r.id === round.id ? { ...r, timerSeconds } : r,
                    ),
                  });
                }}
              />
            </div>
          ))}
          <Button type="submit" disabled={locked}>
            Save Phase B rounds
          </Button>
        </form>
      </Panel>
    </div>
  );
}
