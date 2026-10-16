import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Panel,
  ScoreDisplay,
  StatCardFace,
  StatusPill,
  Stepper,
  Tile,
  type TileState,
  Timer,
} from '@/components';
import { MOCK_ROUND, MOCK_ROUND_RESULT, shuffleNumbers } from '@/mocks';

type Phase = 'announce' | 'palette' | 'result';

export function RoundPage() {
  const [phase, setPhase] = useState<Phase>('announce');
  const [seed, setSeed] = useState(() => Date.now());
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);

  const numbers = useMemo(() => shuffleNumbers(seed), [seed]);

  const tileState = (n: number): TileState => {
    if (n === 7) return 'reserved';
    if (n === 13 || n === 99) return 'disabled';
    if (locked && selected === n) return 'locked';
    if (selected === n) return 'selected';
    return 'default';
  };

  function reshuffle() {
    setSeed(Date.now());
    setSelected(null);
    setLocked(false);
  }

  if (phase === 'result') {
    return (
      <div className="stack">
        <RoundHeader />
        <div className="asymmetric">
          <Panel title="Round result" accent="blue">
            <p>Your pick: {MOCK_ROUND_RESULT.ownPick}</p>
            <p>Target: {MOCK_ROUND_RESULT.target}</p>
            <p>Bucket: {MOCK_ROUND_RESULT.bucket}</p>
            <p>
              Score delta: <ScoreDisplay value={MOCK_ROUND_RESULT.scoreDelta} size="sm" />
            </p>
            <Button onClick={() => setPhase('announce')}>Replay announcement</Button>
          </Panel>
          <Panel title="Breakdown" accent="red">
            <ul>
              <li>Exact match: {MOCK_ROUND_RESULT.components.exactMatch}</li>
              <li>Minority: {MOCK_ROUND_RESULT.components.minority}</li>
              <li>Majority: {MOCK_ROUND_RESULT.components.majority}</li>
              <li>Clash: {MOCK_ROUND_RESULT.components.clash}</li>
            </ul>
          </Panel>
        </div>
      </div>
    );
  }

  const showPalette = phase === 'palette';

  return (
    <div className="stack">
      <RoundHeader showTimer={showPalette} />

      <div
        className={[
          'stat-to-palette',
          showPalette ? 'stat-to-palette--show-palette' : 'stat-to-palette--show-card',
        ].join(' ')}
      >
        <div className="stat-to-palette__card stack">
          <StatCardFace
            title={MOCK_ROUND.statCard.title}
            formula={MOCK_ROUND.statCard.formula}
            description={MOCK_ROUND.statCard.description}
            variant={MOCK_ROUND.statCard.id}
          />
          <div className="row">
            <Button onClick={() => setPhase('palette')}>Reveal palette</Button>
            <Button variant="secondary" onClick={() => setPhase('result')}>
              Skip to result
            </Button>
          </div>
        </div>

        <div className="stat-to-palette__palette stack">
          <Panel accent="yellow" title="Number palette 1–100">
            <p>
              Arrangement is shuffled per team/round (MOCK client shuffle). Use New arrangement to
              demonstrate a different layout.
            </p>
            <div className="row">
              <StatusPill
                status={locked ? 'done' : 'live'}
                label={locked ? 'Pick locked' : 'Selecting'}
              />
              <Button variant="secondary" onClick={reshuffle}>
                New arrangement
              </Button>
              <Button onClick={() => setLocked(true)} disabled={selected === null || locked}>
                Lock in
              </Button>
              <Button variant="ghost" onClick={() => setPhase('announce')}>
                Back to card
              </Button>
              <Button variant="secondary" onClick={() => setPhase('result')}>
                View result
              </Button>
            </div>
          </Panel>
          <div className="palette-grid" role="group" aria-label="Number palette">
            {numbers.map((n) => (
              <Tile
                key={`${seed}-${n}`}
                value={n}
                state={tileState(n)}
                onClick={() => {
                  if (!locked) setSelected(n);
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
              <Timer seconds={MOCK_ROUND.selectionSeconds} />
            </div>
            <Button
              variant={locked ? 'secondary' : 'primary'}
              disabled={selected === null || locked}
              onClick={() => setLocked(true)}
            >
              {locked ? 'Locked' : selected !== null ? `Lock #${selected}` : 'Pick a number'}
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function RoundHeader({ showTimer = false }: { showTimer?: boolean }) {
  return (
    <header className="page-header">
      <div>
        <Badge tone="yellow">MOCK</Badge>
        <h1 className="page-header__title">Round {MOCK_ROUND.roundNumber}</h1>
        <p className="page-header__meta">{MOCK_ROUND.phaseLabel}</p>
      </div>
      <div className="row">
        <Stepper total={MOCK_ROUND.totalRounds} current={MOCK_ROUND.roundNumber} />
        {showTimer ? <Timer seconds={MOCK_ROUND.selectionSeconds} /> : null}
      </div>
    </header>
  );
}
