import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, LoadingState, Panel, StatusPill, WaitingState } from '@/components';
import { useAuth } from '@/context/useAuth';
import { getRoundCurrentApi } from '@/api/rounds';
import type { TeamRoundView } from '@/api/rounds';

const POLL_INTERVAL_MS = 4000;

export function TeamLobbyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [roundView, setRoundView] = useState<TeamRoundView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await getRoundCurrentApi();
        if (!cancelled) setRoundView(data);
      } catch {
        // no active round or network error — leave current state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void poll();
    const id = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const round = roundView?.round ?? null;

  const statusLabel = round
    ? round.status === 'LOBBY'
      ? 'Lobby'
      : round.status === 'SELECTION'
        ? 'Selection open'
        : round.status === 'RESULT'
          ? 'Result'
          : round.status
    : 'Waiting';

  const statusPill: 'waiting' | 'live' | 'ok' | 'done' =
    round?.status === 'SELECTION'
      ? 'live'
      : round?.status === 'RESULT'
        ? 'done'
        : 'waiting';

  if (loading) return <LoadingState title="Loading lobby…" />;

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">{user?.team?.name ?? 'Team Lobby'}</h1>
          <p className="page-header__meta">
            {round
              ? `Game Phase B · Round ${round.roundNumber}`
              : 'Waiting for the next stage · stay connected'}
          </p>
        </div>
        <StatusPill status={statusPill} label={statusLabel} />
      </header>

      <div className="asymmetric">
        {!round || round.status === 'LOBBY' ? (
          <WaitingState
            title="Lobby"
            description={
              round
                ? `Round ${round.roundNumber} is open in lobby phase. Stat card: ${round.statCard}. The organiser will open selection shortly.`
                : 'Organisers have not opened the next round yet. Stay connected.'
            }
          />
        ) : (
          <WaitingState
            title={round.status === 'RESULT' ? 'Result ready' : 'Round in progress'}
            description={
              round.status === 'RESULT'
                ? `Round ${round.roundNumber} has concluded. Check your result below.`
                : `Round ${round.roundNumber} selection is open. Submit your pick now.`
            }
          />
        )}

        <Panel title="Current round" accent="blue">
          {round ? (
            <>
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <Badge tone={round.status === 'SELECTION' ? 'red' : round.status === 'RESULT' ? 'blue' : 'yellow'}>
                  {round.status}
                </Badge>
              </div>
              <p style={{ margin: '0 0 var(--space-2) 0' }}>
                Round <strong>{round.roundNumber}</strong>
              </p>
              <p style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)' }}>
                Stat card: <strong>{round.statCard}</strong>
              </p>
              <div className="row">
                <Button onClick={() => navigate('/team/round')}>
                  {round.status === 'SELECTION' ? 'Pick your number →' : 'Open round screen'}
                </Button>
                <Button variant="secondary" onClick={() => navigate('/team/rapid-fire')}>
                  Rapid fire
                </Button>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 var(--space-3) 0' }}>No active round.</p>
              <div className="row">
                <Button variant="secondary" onClick={() => navigate('/team/rapid-fire')}>
                  Rapid fire
                </Button>
                <Button variant="ghost" onClick={() => navigate('/leaderboard')}>
                  Leaderboard
                </Button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
