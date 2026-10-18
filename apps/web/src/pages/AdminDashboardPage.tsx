import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, ErrorState, LoadingState, Panel, StatusPill } from '@/components';
import { useEventConfig } from '@/hooks/useEventConfig';
import { getAdminRoundCurrentApi, type AdminRoundState } from '@/api/rounds';

export function AdminDashboardPage() {
  const { bundle, loading, error, refresh } = useEventConfig();
  const [liveRound, setLiveRound] = useState<AdminRoundState | null>(null);

  useEffect(() => {
    if (bundle?.event.status === 'LIVE') {
      getAdminRoundCurrentApi()
        .then(setLiveRound)
        .catch(() => {});
    }
  }, [bundle?.event.status]);

  if (loading) return <LoadingState title="Loading dashboard" />;
  if (error || !bundle) {
    return (
      <ErrorState
        title="Could not load dashboard"
        description={error ?? undefined}
        actionLabel="Retry"
        onAction={() => void refresh()}
      />
    );
  }

  const { event, readiness, questionSets, rounds } = bundle;
  const isDraft = event.status === 'DRAFT';
  const isLive = event.status === 'LIVE';
  const isReady = event.status === 'READY';
  const totalQuestions = questionSets.reduce((sum, s) => sum + s.questions.length, 0);
  const phaseBRounds = rounds.filter((r) => r.gamePhase === 'B');
  const configuredStatCards = phaseBRounds.filter((r) => r.statCard !== null).length;

  const sections = [
    {
      id: 'teams',
      title: 'Teams',
      blurb: 'Create, reset credentials, and disable/enable team accounts.',
      accent: 'blue' as const,
      status: 'Live API',
    },
    {
      id: 'questions',
      title: 'Questions & Sets',
      blurb: `${questionSets.length} sets, ${totalQuestions} questions configured.`,
      accent: 'yellow' as const,
      status: 'Live API',
    },
    {
      id: 'rapid-fire',
      title: 'Rapid Fire (Phase A)',
      blurb: 'Launch questions live, track submissions, and award power-up cards.',
      accent: 'red' as const,
      status: 'Live API',
    },
    {
      id: 'card-mapping',
      title: 'Card Mapping & Supply',
      blurb: `Reserve supply capped at 1. Configured across all 4 power-ups.`,
      accent: 'blue' as const,
      status: 'Live API',
    },
    {
      id: 'rounds',
      title: 'Rounds & Stat Cards',
      blurb: `Phase A: ${event.gamePhaseARoundCount} rounds | Phase B: ${configuredStatCards}/${phaseBRounds.length} stat cards assigned.`,
      accent: 'red' as const,
      status: 'Live API',
    },
    {
      id: 'settings',
      title: 'Event Settings & Rules',
      blurb: readiness.canMarkReady
        ? 'All prerequisites met. Ready for lock.'
        : `${readiness.issues.length} readiness issue(s) remaining.`,
      accent: readiness.canMarkReady ? ('blue' as const) : ('yellow' as const),
      status: 'Live API',
    },
    {
      id: 'live-round',
      path: '/admin/rounds',
      title: 'Live Round Controller',
      blurb: `Start, open selection, resolve and void Game Phase B rounds. Live pick submissions board.`,
      accent: 'red' as const,
      status: 'Live API',
    },
    {
      id: 'live',
      title: 'Live Monitor',
      blurb: 'Real-time pick and connection monitor for event gameplay.',
      accent: 'blue' as const,
      status: 'Live API',
    },
    {
      id: 'leaderboard',
      title: 'Leaderboard',
      blurb: 'Public and admin score display rounded strictly to 4 decimal places.',
      accent: 'blue' as const,
      status: 'Live API',
    },
  ];

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone={isDraft ? 'yellow' : isLive ? 'red' : isReady ? 'blue' : 'black'}>
            {event.status}
          </Badge>
          <h1 className="page-header__title">{event.name} — Control Centre</h1>
          <p className="page-header__meta">
            Live event administration — Phases 1–5 complete.
          </p>
        </div>
        <StatusPill
          status={readiness.canMarkReady ? 'ok' : 'waiting'}
          label={
            readiness.canMarkReady
              ? `Status: ${event.status}`
              : `${readiness.issues.length} config issue(s)`
          }
        />
      </header>

      {liveRound?.round && (
        <Panel
          title={`Game Phase B — Live Round Status (Round ${liveRound.round.roundNumber})`}
          accent="red"
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>
                Status:{' '}
                <StatusPill
                  status={
                    liveRound.round.status === 'RESULT'
                      ? 'done'
                      : liveRound.round.status === 'SELECTION'
                        ? 'live'
                        : 'waiting'
                  }
                  label={
                    liveRound.round.status === 'RESULT'
                      ? `Round ${liveRound.round.roundNumber} Complete`
                      : liveRound.round.status
                  }
                />{' '}
                <span style={{ marginLeft: 'var(--space-2)' }}>
                  Stat Card: <strong>{liveRound.round.statCard}</strong>
                </span>
                {liveRound.round.status === 'RESULT' && liveRound.round.displayTarget && (
                  <span style={{ marginLeft: 'var(--space-2)' }}>
                    Target: <strong>{liveRound.round.displayTarget}</strong>
                  </span>
                )}
              </p>
            </div>
            <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
              {liveRound.round.status === 'RESULT' && (
                <Link to="/admin/rounds">
                  <Button>Start Round {liveRound.round.roundNumber + 1} (Lobby) →</Button>
                </Link>
              )}
              <Link to="/admin/rounds" style={{ fontWeight: 600 }}>
                Open Round Controller →
              </Link>
            </div>
          </div>
        </Panel>
      )}

      {readiness.issues.length > 0 && (
        <Panel title="Configuration Readiness Alert" accent="yellow">
          <p style={{ margin: '0 0 var(--space-2) 0', fontWeight: 600 }}>
            The following requirements must be resolved before the event can be locked as READY:
          </p>
          <ul className="issue-list">
            {readiness.issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid-12">
        {sections.map((section) => (
          <div key={section.id} className="grid-span-4">
            <Panel title={section.title} accent={section.accent}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <Badge tone={section.status === 'Live API' ? 'blue' : 'yellow'}>
                  {section.status}
                </Badge>
              </div>
              <p style={{ minHeight: '3rem' }}>{section.blurb}</p>
              <Link to={section.path ?? `/admin/${section.id}`} style={{ fontWeight: 600 }}>
                Open section →
              </Link>
            </Panel>
          </div>
        ))}
      </div>
    </div>
  );
}
