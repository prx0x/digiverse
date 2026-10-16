import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Wordmark, Badge } from '@/components';
import { useAuth } from '@/context';
import './layouts.css';
const ADMIN_NAV_LINKS = [
  { path: '/admin/teams', label: 'Teams' },
  { path: '/admin/questions', label: 'Questions & Sets' },
  { path: '/admin/rapid-fire', label: 'Rapid Fire (Phase A)' },
  { path: '/admin/card-mapping', label: 'Card Mapping' },
  { path: '/admin/rounds', label: 'Rounds & Stat Cards' },
  { path: '/admin/settings', label: 'Event Settings' },
  { path: '/admin/live', label: 'Live Monitor' },
  { path: '/admin/leaderboard', label: 'Leaderboard' },
];

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
        BUILD PHASE 4 ACTIVE — Signed in as Admin ({user?.identifier}). Rapid Fire gameplay & power-up acquisition live.
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
          {ADMIN_NAV_LINKS.map((item) => (
            <NavLink key={item.path} to={item.path}>
              {item.label}
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
