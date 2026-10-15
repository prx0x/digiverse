import { useState, type FormEvent } from 'react';
import { STAT_CARDS, type StatCard } from '@digiverse/shared';
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
} from '@/components';
import { putAdminEventApi, putRoundsApi } from '@/api/event';
import { formatApiError, useEventConfig } from '@/hooks/useEventConfig';

export function AdminRoundsPage() {
  const { bundle, setBundle, loading, error, locked, refresh } = useEventConfig();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="blue">LIVE</Badge>
          <h1 className="page-header__title">Rounds & Stat Cards</h1>
          <p className="page-header__meta">
            Round counts for Game Phase A (Rapid Fire) and Game Phase B (Main Game).
          </p>
        </div>
      </header>
      {formError ? (
        <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
          {formError}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}

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
              id="rf-default"
              label="Rapid-fire default time (s)"
              type="number"
              min={1}
              disabled={locked}
              value={bundle.event.rapidFireDefaultTimeLimitSeconds}
              onChange={(e) =>
                setBundle({
                  ...bundle,
                  event: {
                    ...bundle.event,
                    rapidFireDefaultTimeLimitSeconds: Number(e.target.value),
                  },
                })
              }
            />
            <Input
              id="selection-s"
              label="Selection window default (s)"
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
              id="announce-s"
              label="Stat-card announcement (s)"
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
