import { useEffect, useState } from 'react';
import { Badge, Button, ErrorState, LoadingState, ScoreDisplay, StatusPill, Table } from '@/components';
import { getLeaderboardApi, type LeaderboardEntry } from '@/api/rounds';
import { useWebSocket } from '@/context';

export function AdminLeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const { status: wsStatus, subscribe, latencyMs } = useWebSocket();

  async function loadLeaderboard() {
    try {
      const res = await getLeaderboardApi();
      setEntries(res.leaderboard);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeaderboard();

    const unsubs = [
      subscribe('leaderboard:update', () => void loadLeaderboard()),
      subscribe('round:result', () => void loadLeaderboard()),
      subscribe('round:voided', () => void loadLeaderboard()),
      subscribe('rapidfire:awarded', () => void loadLeaderboard()),
    ];

    const interval = setInterval(() => {
      void loadLeaderboard();
    }, 4000);

    return () => {
      unsubs.forEach((unsub) => unsub());
      clearInterval(interval);
    };
  }, [subscribe]);

  function exportCsv() {
    if (!entries.length) return;
    const header = ['Rank', 'Team Name', 'Team Tag', 'Rounds With Gain', 'Cards Held', 'Score (4 dp)', 'Raw Score'];
    const rows = entries.map((e) => [
      e.rank,
      `"${e.name.replace(/"/g, '""')}"`,
      `"${(e.tag ?? '').replace(/"/g, '""')}"`,
      e.positiveRounds,
      e.cardsHeld,
      e.displayScore,
      e.rawScore,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `digiverse-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading && entries.length === 0) return <LoadingState title="Loading admin leaderboard" />;

  const filteredEntries = entries.filter(
    (e) =>
      e.name.toLowerCase().includes(filterText.toLowerCase()) ||
      (e.tag && e.tag.toLowerCase().includes(filterText.toLowerCase())),
  );

  return (
    <div className="stack">
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <Badge tone="red">ADMIN</Badge>
              <StatusPill
                status={wsStatus === 'connected' ? 'ok' : wsStatus === 'connecting' ? 'waiting' : 'error'}
                label={
                  wsStatus === 'connected'
                    ? `Live Sync${latencyMs !== null ? ` (${latencyMs}ms)` : ''}`
                    : 'Disconnected (Polling)'
                }
              />
            </div>
            <h1 className="page-header__title">Official Event Leaderboard</h1>
            <p className="page-header__meta">
              Official standings calculated using exact decimal arithmetic, formatted strictly to 4 decimal places.
            </p>
          </div>

          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => void loadLeaderboard()}>
              Refresh
            </Button>
            <Button disabled={entries.length === 0} onClick={exportCsv}>
              Export to CSV
            </Button>
          </div>
        </div>
      </header>

      {error ? (
        <ErrorState
          title="Could not load leaderboard"
          description={error}
          actionLabel="Retry"
          onAction={() => {
            setLoading(true);
            void loadLeaderboard();
          }}
        />
      ) : null}

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Filter by team name or tag…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            border: '2px solid var(--color-ink, #000)',
            fontFamily: 'inherit',
            fontSize: 'var(--font-size-sm)',
            maxWidth: '320px',
            width: '100%',
          }}
        />
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)' }}>
          Showing {filteredEntries.length} of {entries.length} teams
        </span>
      </div>

      <div aria-live="polite" aria-atomic="false">
        <Table
          headers={['Rank', 'Team', 'Rounds With Gain', 'Cards Held', 'Raw Score', 'Final Score']}
          caption="Official Event Leaderboard"
        >
        {filteredEntries.map((row) => (
          <tr key={row.teamId}>
            <td>
              <strong>#{row.rank}</strong>
            </td>
            <td>
              <strong>{row.name}</strong> {row.tag ? `(${row.tag})` : ''}
            </td>
            <td>{row.positiveRounds}</td>
            <td>{row.cardsHeld}</td>
            <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
              {row.rawScore}
            </td>
            <td className="table__score">
              <ScoreDisplay value={row.displayScore} size="sm" label={`${row.name} score`} />
            </td>
          </tr>
        ))}
      </Table>
      </div>
    </div>
  );
}
