import { useEffect, useState } from 'react';
import type { StatCard } from '@digiverse/shared';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  ScoreDisplay,
  StatCardFace,
  StatusPill,
  Stepper,
  Table,
  Tile,
  type TileState,
  Timer,
} from '@/components';
import {
  getRoundCurrentApi,
  playCardApi,
  submitPickApi,
  type TeamRoundView,
} from '@/api/rounds';
import { useWebSocket } from '@/context';

const STAT_CARD_INFO: Record<
  StatCard,
  { title: string; formula: string; description: string }
> = {
  MEAN: {
    title: 'Arithmetic Mean',
    formula: 'μ = (∑ xᵢ) / N',
    description: 'Average of all unique non-conflicting picks submitted.',
  },
  TWO_THIRDS: {
    title: 'Two-thirds of the Mean',
    formula: '(2/3) × μ',
    description: 'Two-thirds of the arithmetic mean of all non-conflicting picks.',
  },
  MIDRANGE: {
    title: 'Midrange',
    formula: '(min + max) / 2',
    description: 'Midpoint between the lowest and highest unique non-conflicting picks.',
  },
  MEAN_PLUS_SIGMA: {
    title: 'Mean + 1σ',
    formula: 'μ + σ',
    description: 'Arithmetic mean plus one population standard deviation.',
  },
  GEOMETRIC_MEAN: {
    title: 'Geometric Mean',
    formula: '(∏ xᵢ)^(1/N)',
    description: 'The N-th root of the product of all unique non-conflicting picks.',
  },
};

export function RoundPage() {
  const [data, setData] = useState<TeamRoundView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reserveInput, setReserveInput] = useState<number>(50);
  const { subscribe } = useWebSocket();

  async function loadCurrentRound() {
    try {
      const res = await getRoundCurrentApi();
      setData(res);
      setError(null);
      if (res.myPick?.pick) {
        setSelected(res.myPick.pick);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load round');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCurrentRound();

    const unsubs = [
      subscribe('round:lobby', () => void loadCurrentRound()),
      subscribe('round:selection_opened', () => void loadCurrentRound()),
      subscribe('round:number_reserved', () => void loadCurrentRound()),
      subscribe('round:reverse_played', () => void loadCurrentRound()),
      subscribe('round:result', () => void loadCurrentRound()),
      subscribe('round:timer_extended', () => void loadCurrentRound()),
      subscribe('round:voided', () => void loadCurrentRound()),
    ];

    const interval = setInterval(() => {
      void loadCurrentRound();
    }, 3000);

    return () => {
      unsubs.forEach((unsub) => unsub());
      clearInterval(interval);
    };
  }, [subscribe]);

  if (loading && !data) return <LoadingState title="Loading round status" />;

  if (error && !data) {
    return (
      <ErrorState
        title="Could not load round"
        description={error}
        actionLabel="Retry"
        onAction={() => {
          setLoading(true);
          void loadCurrentRound();
        }}
      />
    );
  }

  if (!data?.active || !data.round) {
    return (
      <div className="stack">
        <header className="page-header">
          <div>
            <Badge tone="yellow">LOBBY</Badge>
            <h1 className="page-header__title">Main Game — Game Phase B</h1>
            <p className="page-header__meta">Waiting for round to start</p>
          </div>
        </header>
        <EmptyState
          title="Round Has Not Started"
          description="The admin will launch the round soon. When launched, the formula will appear here."
        />
      </div>
    );
  }

  const round = data.round;
  const isLobby = round.status === 'LOBBY';
  const isSelection = round.status === 'SELECTION';
  const isResult = round.status === 'RESULT';

  const cardInfo = STAT_CARD_INFO[round.statCard] ?? STAT_CARD_INFO.MEAN;
  const isLocked = Boolean(data.myPick?.isLocked);

  async function handleLockIn() {
    if (selected === null || isLocked) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await submitPickApi(selected);
      setConfirming(false);
      await loadCurrentRound();
      setActionMessage(`Pick #${selected} locked successfully!`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to lock pick');
    } finally {
      setActionBusy(false);
    }
  }

  async function handlePlayCard(cardType: import('@digiverse/shared').PowerUpCard, reservedNum?: number) {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await playCardApi(cardType, reservedNum);
      await loadCurrentRound();
      if (cardType === 'PEEK') {
        const count = res.metadata?.peekCount ?? 0;
        setActionMessage(`Peek snapshot: exactly ${count} picks strictly under 50 submitted so far!`);
      } else {
        setActionMessage(`${cardType} played successfully!`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to play ${cardType}`);
    } finally {
      setActionBusy(false);
    }
  }

  const tileState = (n: number): TileState => {
    if (data.reservedNumbers.includes(n)) return 'reserved';
    if (isLocked && selected === n) return 'locked';
    if (selected === n) return 'selected';
    return 'default';
  };

  if (isResult && data.result) {
    return (
      <div className="stack">
        <header className="page-header">
          <div>
            <Badge tone="blue">ROUND {round.roundNumber} COMPLETE</Badge>
            <h1 className="page-header__title">Round {round.roundNumber} Result</h1>
            <p className="page-header__meta">{cardInfo.title}</p>
          </div>
          <div className="row">
            <span style={{ fontWeight: 600 }}>Score:</span>
            <ScoreDisplay value={data.currentScore} size="md" />
          </div>
        </header>

        <div className="asymmetric">
          <Panel title="Outcome" accent="blue">
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <p>
                <strong>Statistical Target:</strong>{' '}
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold' }}>
                  {data.result.displayTarget ?? 'No Target (Degenerate)'}
                </span>
              </p>
              <p>
                <strong>Your Locked Pick:</strong>{' '}
                {data.myPick ? (
                  <Badge tone="yellow">#{data.myPick.pick}</Badge>
                ) : (
                  <Badge tone="red">No pick submitted</Badge>
                )}
              </p>
              {data.result.isReversed ? (
                <p>
                  <Badge tone="red">Reverse in Effect</Badge> (Majority & Minority scoring flipped)
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel title="Score Ledger Entries" accent="yellow">
            {data.result.ledgerEntries.length > 0 ? (
              <ul className="stack" style={{ gap: 'var(--space-2)' }}>
                {data.result.ledgerEntries.map((e, idx) => (
                  <li key={idx}>
                    <strong>{e.component}:</strong>{' '}
                    <span
                      style={{
                        color: e.pointsDelta.startsWith('-')
                          ? 'var(--color-danger)'
                          : 'var(--color-fg)',
                        fontWeight: 'bold',
                      }}
                    >
                      {e.pointsDelta.startsWith('-') ? e.pointsDelta : `+${e.pointsDelta}`}
                    </span>{' '}
                    — {e.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No score change for this round.</p>
            )}
          </Panel>
        </div>

        {/* Revealed picks per OPEN-029 */}
        {data.result.revealedPicks && data.result.revealedPicks.length > 0 ? (
          <Panel title="Revealed Picks (All Teams)" accent="yellow">
            <Table headers={['Team Name', 'Pick Value']} caption="Revealed Picks">
              {data.result.revealedPicks.map((rp) => (
                <tr key={rp.teamId}>
                  <td>{rp.teamName}</td>
                  <td>
                    <Badge tone="yellow">#{rp.pick}</Badge>
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
        ) : null}
      </div>
    );
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone={isLobby ? 'yellow' : isSelection ? 'blue' : 'black'}>
            ROUND {round.roundNumber} · {round.status}
          </Badge>
          <h1 className="page-header__title">Round {round.roundNumber}</h1>
          <p className="page-header__meta">{cardInfo.title}</p>
        </div>
        <div className="row">
          <Stepper total={5} current={round.roundNumber} />
          {isSelection ? (
            <Timer seconds={round.selectionSeconds} />
          ) : isLobby ? (
            <Timer seconds={round.lobbySeconds} />
          ) : null}
        </div>
      </header>

      {actionError ? (
        <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
          {actionError}
        </p>
      ) : null}
      {actionMessage ? (
        <p role="status" style={{ color: 'var(--color-blue)', fontWeight: 600 }}>
          {actionMessage}
        </p>
      ) : null}

      <div
        className={[
          'stat-to-palette',
          isSelection ? 'stat-to-palette--show-palette' : 'stat-to-palette--show-card',
        ].join(' ')}
      >
        {/* Stat Card Side */}
        <div className="stat-to-palette__card stack">
          <StatCardFace
            title={cardInfo.title}
            formula={cardInfo.formula}
            description={cardInfo.description}
            variant={round.statCard}
          />

          {isLobby ? (
            <Panel title="Lobby Card Play (Pre-Round)" accent="yellow">
              <p>Shield and Reserve can only be played during Lobby before selection opens.</p>
              <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {data.myCardPlayed ? (
                  <Badge tone="yellow">Card Played: {data.myCardPlayed.cardType}</Badge>
                ) : (
                  <>
                    <Button
                      disabled={data.inventory.SHIELD <= 0 || actionBusy}
                      onClick={() => handlePlayCard('SHIELD')}
                    >
                      Play Shield ({data.inventory.SHIELD})
                    </Button>

                    {data.inventory.RESERVE > 0 ? (
                      <div className="row" style={{ alignItems: 'center' }}>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={reserveInput}
                          onChange={(e) => setReserveInput(Number(e.target.value))}
                          style={{ width: '80px', padding: '6px' }}
                        />
                        <Button
                          disabled={actionBusy}
                          onClick={() => handlePlayCard('RESERVE', reserveInput)}
                        >
                          Reserve Number
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </Panel>
          ) : null}
        </div>

        {/* Palette Side */}
        <div className="stat-to-palette__palette stack">
          <Panel accent="yellow" title="Number Palette 1–100">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="row" style={{ alignItems: 'center' }}>
                <StatusPill
                  status={isLocked ? 'done' : selected !== null ? 'live' : 'waiting'}
                  label={isLocked ? `Locked in #${selected}` : selected !== null ? `Selected #${selected}` : 'Pick a number'}
                />
                {round.isReversed ? (
                  <Badge tone="red">REVERSE ACTIVE ({round.reverseCount})</Badge>
                ) : null}
              </div>

              {/* During-round card options */}
              {isSelection && !data.myCardPlayed ? (
                <div className="row">
                  {data.inventory.PEEK > 0 ? (
                    <Button
                      variant="secondary"
                      disabled={actionBusy}
                      onClick={() => handlePlayCard('PEEK')}
                    >
                      Play Peek ({data.inventory.PEEK})
                    </Button>
                  ) : null}

                  {data.inventory.REVERSE > 0 ? (
                    <Button
                      variant="danger"
                      disabled={actionBusy}
                      onClick={() => handlePlayCard('REVERSE')}
                    >
                      Play Reverse ({data.inventory.REVERSE})
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Lock in confirmation step per OPEN-014 */}
            {!isLocked && selected !== null ? (
              <div
                className="row"
                style={{
                  marginTop: 'var(--space-2)',
                  padding: 'var(--space-2)',
                  background: 'var(--color-bg-subtle)',
                  borderRadius: '2px',
                }}
              >
                {confirming ? (
                  <>
                    <span>Are you sure? Once locked, your pick cannot be changed!</span>
                    <Button variant="danger" disabled={actionBusy} onClick={handleLockIn}>
                      Yes, Lock #{selected}!
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setConfirming(true)}>
                    Lock in #{selected}
                  </Button>
                )}
              </div>
            ) : null}
          </Panel>

          <div className="palette-grid" role="group" aria-label="Number palette">
            {data.myPalette.map((n) => (
              <Tile
                key={n}
                value={n}
                state={tileState(n)}
                onClick={() => {
                  if (!isLocked && !data.reservedNumbers.includes(n)) {
                    setSelected(n);
                    setConfirming(false);
                  }
                }}
              />
            ))}
          </div>

          <div className="palette-spacer-for-bar" aria-hidden="true" />

          {/* Mobile Sticky Selection Action Bar */}
          <aside className="palette-sticky-bar" aria-label="Mobile number selection bar">
            <div className="palette-sticky-bar__info">
              <div className="palette-sticky-bar__pick">
                <span>Pick:</span>
                <span className="palette-sticky-bar__badge">
                  {selected !== null ? selected : '—'}
                </span>
              </div>
              <Timer seconds={round.selectionSeconds} />
            </div>
            <Button
              variant={isLocked ? 'secondary' : 'primary'}
              disabled={selected === null || isLocked || actionBusy}
              onClick={() => {
                if (confirming) {
                  void handleLockIn();
                } else {
                  setConfirming(true);
                }
              }}
            >
              {isLocked
                ? `Locked #${selected}`
                : confirming
                  ? `Confirm #${selected}?`
                  : selected !== null
                    ? `Lock #${selected}`
                    : 'Pick a number'}
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}
