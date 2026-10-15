import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Wordmark, Badge } from '@/components';
import { useAuth } from '@/context';
import './layouts.css';

const links = [
  { to: '/team', label: 'Lobby', end: true },
  { to: '/team/rapid-fire', label: 'Rapid Fire' },
  { to: '/team/round', label: 'Round' },
  { to: '/team/inventory', label: 'Inventory' },
  { to: '/team/leaderboard', label: 'Leaderboard' },
];

export function TeamLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const teamDisplayName = user?.team?.name || user?.identifier || 'Team';
  const teamTag = user?.team?.tag;

  return (
    <div className="shell">
      <div className="mock-banner" role="note">
        LIVE AUTH (Phase 2) — Authenticated as {user?.role === 'admin' ? 'Administrator' : teamDisplayName}. Gameplay data mock until Phase 3–5.
      </div>
      <header className="shell__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Wordmark to="/team" inverse />
          {teamTag && <Badge tone="yellow">{teamTag}</Badge>}
        </div>
        <nav className="shell__nav" aria-label="Team">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && <NavLink to="/admin">Admin Panel</NavLink>}
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
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
