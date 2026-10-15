import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Wordmark, Badge } from '@/components';
import { MOCK_ADMIN_SECTIONS } from '@/mocks';
import { useAuth } from '@/context';
import './layouts.css';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="shell shell--admin">
      <div className="mock-banner" role="note">
        LIVE AUTH (Phase 2) — Signed in as Admin ({user?.identifier}). Section controls mock until Phase 3.
      </div>
      <header className="shell__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Wordmark to="/admin" inverse />
          <Badge tone="red">ADMIN</Badge>
        </div>
        <nav className="shell__nav" aria-label="Admin utility">
          <NavLink to="/team">Team view</NavLink>
          <NavLink to="/gallery">Gallery</NavLink>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-ink-inverse)',
              font: 'inherit',
              cursor: 'pointer',
              padding: 'var(--space-2) var(--space-3)',
            }}
          >
            Logout
          </button>
        </nav>
      </header>
      <aside className="admin-sidebar">
        <nav aria-label="Admin sections">
          <NavLink to="/admin" end>
            Dashboard
          </NavLink>
          {MOCK_ADMIN_SECTIONS.map((section) => (
            <NavLink key={section.id} to={`/admin/${section.id}`}>
              {section.title}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
