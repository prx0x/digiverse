import { useState } from 'react';
import { Badge, Button, Input, Panel, StatusPill, Timer } from '@/components';
import { MOCK_RAPID_FIRE } from '@/mocks';

export function RapidFirePage() {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState<boolean>(MOCK_RAPID_FIRE.submitted);

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="yellow">MOCK</Badge>
          <h1 className="page-header__title">Rapid Fire</h1>
          <p className="page-header__meta">{MOCK_RAPID_FIRE.setLabel}</p>
        </div>
        <div className="row">
          <StatusPill
            status={submitted ? 'done' : 'live'}
            label={submitted ? 'Submitted' : 'Open'}
          />
          <Timer seconds={MOCK_RAPID_FIRE.remainingSeconds} />
        </div>
      </header>

      <Panel accent="red" title="Question">
        <p style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-fg)', marginBottom: 'var(--space-5)' }}>
          {MOCK_RAPID_FIRE.prompt}
        </p>
        {submitted ? (
          <StatusPill status="ok" label="Answer locked — waiting for awards" />
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <Input
              id="rf-answer"
              label="Your answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              required
            />
            <Button type="submit">Submit answer</Button>
          </form>
        )}
      </Panel>
    </div>
  );
}
