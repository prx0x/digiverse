import { useState } from 'react';
import {
  Badge,
  Button,
  CompletedState,
  DisconnectedState,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LoadingState,
  Modal,
  Panel,
  PowerUpCard,
  ScoreDisplay,
  Select,
  StatCardFace,
  StatusPill,
  Stepper,
  Table,
  Tabs,
  Tile,
  Timer,
  Toast,
  ToastStack,
  WaitingState,
  Wordmark,
} from '@/components';
import { MOCK_STAT_CARDS } from '@/mocks';

export function GalleryPage() {
  const [tab, setTab] = useState('one');
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="shell">
      <div className="mock-banner">Component gallery — Bauhaus primitives and states</div>
      <header className="shell__header">
        <Wordmark to="/" inverse />
        <nav className="shell__nav" aria-label="Gallery">
          <a href="/login">Login</a>
          <a href="/team">Team</a>
          <a href="/admin">Admin</a>
        </nav>
      </header>
      <main className="shell__main">
        <header className="page-header">
          <div>
            <h1 className="page-header__title">Component gallery</h1>
            <p className="page-header__meta">Visual checklist for Build Phase 1 primitives</p>
          </div>
        </header>

        <section className="gallery-section">
          <h2>Actions</h2>
          <div className="gallery-row">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled</Button>
            <IconButton label="Close">×</IconButton>
          </div>
        </section>

        <section className="gallery-section">
          <h2>Badges & status</h2>
          <div className="gallery-row">
            <Badge>Default</Badge>
            <Badge tone="blue">Blue</Badge>
            <Badge tone="red">Red</Badge>
            <Badge tone="yellow">Yellow</Badge>
            <Badge tone="black">Black</Badge>
            <StatusPill status="waiting" label="Waiting" />
            <StatusPill status="live" label="Live" />
            <StatusPill status="ok" label="OK" />
            <StatusPill status="error" label="Error" />
            <StatusPill status="done" label="Done" />
          </div>
        </section>

        <section className="gallery-section">
          <h2>Timer & score</h2>
          <div className="gallery-row">
            <Timer seconds={75} />
            <Timer seconds={8} />
            <ScoreDisplay value="12.3456789012" />
          </div>
        </section>

        <section className="gallery-section">
          <h2>Tiles</h2>
          <div className="gallery-row">
            <Tile value={1} />
            <Tile value={2} state="selected" />
            <Tile value={3} state="locked" />
            <Tile value={4} state="disabled" />
            <Tile value={5} state="reserved" />
          </div>
        </section>

        <section className="gallery-section">
          <h2>Stat cards</h2>
          <div className="grid-12">
            {Object.values(MOCK_STAT_CARDS).map((card) => (
              <div key={card.id} className="grid-span-6">
                <StatCardFace
                  title={card.title}
                  formula={card.formula}
                  description={card.description}
                  variant={card.id}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="gallery-section">
          <h2>Power-ups</h2>
          <div className="gallery-row">
            <PowerUpCard card="SHIELD" count={1} note="Pre-round" />
            <PowerUpCard card="RESERVE" count={0} note="Unique" />
            <PowerUpCard card="PEEK" count={2} note="During round" />
            <PowerUpCard card="REVERSE" count={1} note="Parity flip" />
          </div>
        </section>

        <section className="gallery-section">
          <h2>Forms</h2>
          <div className="gallery-row" style={{ maxWidth: '24rem', width: '100%' }}>
            <div className="stack" style={{ width: '100%' }}>
              <Input id="g-input" label="Sample input" placeholder="Type…" />
              <Select id="g-select" label="Sample select" defaultValue="a">
                <option value="a">Option A</option>
                <option value="b">Option B</option>
              </Select>
            </div>
          </div>
        </section>

        <section className="gallery-section">
          <h2>Tabs, stepper, table</h2>
          <Tabs
            tabs={[
              { id: 'one', label: 'One' },
              { id: 'two', label: 'Two' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <p>Active tab: {tab}</p>
          <Stepper total={5} current={3} />
          <Table headers={['A', 'B']} caption="Sample">
            <tr>
              <td>1</td>
              <td>2</td>
            </tr>
          </Table>
        </section>

        <section className="gallery-section">
          <h2>Panels & modal</h2>
          <div className="gallery-row">
            <Panel title="Default panel">Body copy</Panel>
            <Panel title="Inverse" inverse>
              Inverse panel
            </Panel>
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          </div>
          <Modal open={modalOpen} title="Sample modal" onClose={() => setModalOpen(false)}>
            <p>Modal content with focus trap basics and Escape to close.</p>
          </Modal>
        </section>

        <section className="gallery-section">
          <h2>State views</h2>
          <div className="grid-12">
            <div className="grid-span-4">
              <EmptyState title="Empty" description="Nothing here." />
            </div>
            <div className="grid-span-4">
              <LoadingState title="Loading" description="Fetching…" />
            </div>
            <div className="grid-span-4">
              <ErrorState title="Error" description="Something failed." />
            </div>
            <div className="grid-span-4">
              <DisconnectedState title="Disconnected" description="Reconnect required." />
            </div>
            <div className="grid-span-4">
              <WaitingState title="Waiting" description="Hold for organisers." />
            </div>
            <div className="grid-span-4">
              <CompletedState title="Completed" description="Event finished." />
            </div>
          </div>
        </section>

        <ToastStack>
          <Toast message="Default toast" />
          <Toast tone="success" message="Success toast" />
          <Toast tone="error" message="Error toast" />
        </ToastStack>
      </main>
    </div>
  );
}
