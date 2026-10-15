import { useNavigate, useParams } from 'react-router-dom';
import { Badge, EmptyState, Panel } from '@/components';
import { MOCK_ADMIN_SECTIONS } from '@/mocks';

export function AdminSectionPage() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const section = MOCK_ADMIN_SECTIONS.find((s) => s.id === sectionId);

  if (!section) {
    return (
      <EmptyState
        title="Unknown section"
        description="That admin section does not exist."
        actionLabel="Back to dashboard"
        onAction={() => navigate('/admin')}
      />
    );
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="yellow">MOCK</Badge>
          <h1 className="page-header__title">{section.title}</h1>
          <p className="page-header__meta">{section.blurb}</p>
        </div>
      </header>
      <Panel accent="yellow" title="Placeholder">
        <p>
          This section is a structural placeholder for Build Phase 1. Real configuration and live
          data arrive in Build Phases 2–3.
        </p>
      </Panel>
      <EmptyState
        title="No live data yet"
        description="Connect authentication and persistence in later build phases."
      />
    </div>
  );
}
