import { Link } from 'react-router-dom';
import { Badge, Panel, StatusPill } from '@/components';
import { MOCK_ADMIN_SECTIONS } from '@/mocks';

export function AdminDashboardPage() {
  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="yellow">MOCK</Badge>
          <h1 className="page-header__title">Admin dashboard</h1>
          <p className="page-header__meta">Event control centre — placeholders until later phases</p>
        </div>
        <StatusPill status="ok" label="Draft event" />
      </header>
      <div className="grid-12">
        {MOCK_ADMIN_SECTIONS.map((section) => (
          <div key={section.id} className="grid-span-4">
            <Panel title={section.title} accent="blue">
              <p>{section.blurb}</p>
              <Link to={`/admin/${section.id}`}>Open section</Link>
            </Panel>
          </div>
        ))}
      </div>
    </div>
  );
}
