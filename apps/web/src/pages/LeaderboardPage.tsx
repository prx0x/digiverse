import { Badge, ScoreDisplay, Table } from '@/components';
import { MOCK_LEADERBOARD } from '@/mocks';

export function LeaderboardPage() {
  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="yellow">MOCK</Badge>
          <h1 className="page-header__title">Leaderboard</h1>
          <p className="page-header__meta">Scores displayed to exactly 4 decimal places</p>
        </div>
      </header>
      <Table headers={['Rank', 'Team', 'Score']} caption="Event leaderboard">
        {MOCK_LEADERBOARD.map((row) => (
          <tr key={row.team}>
            <td>{row.rank}</td>
            <td>{row.team}</td>
            <td className="table__score">
              <ScoreDisplay value={row.score} size="sm" label={`${row.team} score`} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
