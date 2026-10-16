import { useEffect, useState } from 'react';
import { Badge, ErrorState, LoadingState, ScoreDisplay, Table } from '@/components';
import { getLeaderboardApi, type LeaderboardEntry } from '@/api/rounds';
import { MOCK_LEADERBOARD } from '@/mocks';

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const interval = setInterval(() => {
      void loadLeaderboard();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading && entries.length === 0) return <LoadingState title="Loading leaderboard" />;

  const isLive = entries.length > 0;

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone={isLive ? 'blue' : 'yellow'}>{isLive ? 'LIVE' : 'MOCK'}</Badge>
          <h1 className="page-header__title">Leaderboard</h1>
          <p className="page-header__meta">
            Scores displayed to exactly 4 decimal places · Tiebreakers: (1) Rounds with gain, (2) Power-up cards held
          </p>
        </div>
      </header>

      {error && !isLive ? (
        <ErrorState
          title="Could not load live leaderboard"
          description={error}
          actionLabel="Retry"
          onAction={() => {
            setLoading(true);
            void loadLeaderboard();
          }}
        />
      ) : isLive ? (
        <Table headers={['Rank', 'Team', 'Rounds With Gain', 'Cards Held', 'Score']} caption="Event leaderboard">
          {entries.map((row) => (
            <tr key={row.teamId}>
              <td>
                <strong>#{row.rank}</strong>
              </td>
              <td>
                <strong>{row.name}</strong> {row.tag ? `(${row.tag})` : ''}
              </td>
              <td>{row.positiveRounds}</td>
              <td>{row.cardsHeld}</td>
              <td className="table__score">
                <ScoreDisplay value={row.displayScore} size="sm" label={`${row.name} score`} />
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Table headers={['Rank', 'Team', 'Score']} caption="Event leaderboard (Preview)">
          {MOCK_LEADERBOARD.map((row) => (
            <tr key={row.team}>
              <td>#{row.rank}</td>
              <td>{row.team}</td>
              <td className="table__score">
                <ScoreDisplay value={row.score} size="sm" label={`${row.team} score`} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
