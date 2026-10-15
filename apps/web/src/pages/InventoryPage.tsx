import { Badge, Panel, PowerUpCard } from '@/components';
import { MOCK_INVENTORY } from '@/mocks';

export function InventoryPage() {
  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="yellow">MOCK</Badge>
          <h1 className="page-header__title">Power-up inventory</h1>
          <p className="page-header__meta">Cards earned in Rapid Fire (Game Phase A)</p>
        </div>
      </header>
      <div className="grid-12">
        {MOCK_INVENTORY.map((item) => (
          <div key={item.card} className="grid-span-3">
            <PowerUpCard card={item.card} count={item.count} note={item.note} />
          </div>
        ))}
      </div>
      <Panel title="How cards work" accent="blue">
        <p>
          Shield and Reserve are played before a round opens. Peek and Reverse are played during
          selection. Reserve is limited to one award for the whole event.
        </p>
      </Panel>
    </div>
  );
}
