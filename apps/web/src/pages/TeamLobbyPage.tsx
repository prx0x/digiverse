import { useNavigate } from 'react-router-dom';
import { Badge, Button, Panel, StatusPill, Stepper, WaitingState } from '@/components';
import { MOCK_ROUND, MOCK_TEAM } from '@/mocks';

export function TeamLobbyPage() {
  const navigate = useNavigate();

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="yellow">MOCK</Badge>
          <h1 className="page-header__title">{MOCK_TEAM.name}</h1>
          <p className="page-header__meta">Waiting for the next stage · tag {MOCK_TEAM.tag}</p>
        </div>
        <StatusPill status="waiting" label="Waiting" />
      </header>

      <div className="asymmetric">
        <WaitingState
          title="Lobby"
          description="Organisers have not opened the next question or round yet. Stay connected."
        />
        <Panel title="Current round" accent="blue">
          <p>
            {MOCK_ROUND.phaseLabel}
            <br />
            Round {MOCK_ROUND.roundNumber} of {MOCK_ROUND.totalRounds}
          </p>
          <Stepper total={MOCK_ROUND.totalRounds} current={MOCK_ROUND.roundNumber} />
          <p>Next formula: {MOCK_ROUND.statCard.title}</p>
          <div className="row">
            <Button onClick={() => navigate('/team/round')}>Open round screen</Button>
            <Button variant="secondary" onClick={() => navigate('/team/rapid-fire')}>
              Rapid fire
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
