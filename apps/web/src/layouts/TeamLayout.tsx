import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Wordmark, Badge, Button, MobileDrawer } from '@/components';
import { useAuth, useWebSocket } from '@/context';
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
  const { status: wsStatus } = useWebSocket();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    setDrawerOpen(false);
    await logout();
    navigate('/login');
  }

  const teamDisplayName = user?.team?.name || user?.identifier || 'Team';
  const teamTag = user?.team?.tag;

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <div className="shell">
      <div className="mock-banner" role="note" style={{ background: 'var(--color-bg-subtle, #f0f4f8)', color: 'var(--color-ink, #000000)', borderBottom: '2px solid var(--color-brand-blue)' }}>
        DIGIVERSE LIVE — Authenticated as {user?.role === 'admin' ? 'Administrator' : teamDisplayName}. Real-time sync active.
      </div>
      <header className="shell__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Wordmark to="/team" inverse />
          {teamTag && <Badge tone="yellow">{teamTag}</Badge>}
          <span style={{ fontSize: 'var(--font-size-xs)', color: wsStatus === 'connected' ? 'var(--color-brand-yellow)' : 'var(--color-brand-red)' }}>
            ● {wsStatus === 'connected' ? 'LIVE' : 'SYNCING'}
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="shell__nav shell__nav--desktop" aria-label="Team">
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
              color: 'var(--color-primary-fg)',
              font: 'inherit',
              cursor: 'pointer',
              padding: 'var(--space-2) var(--space-3)',
            }}
          >
            Logout
          </button>
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="hamburger-btn"
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* Slide-out Bauhaus Mobile Drawer */}
      <MobileDrawer open={drawerOpen} onClose={closeDrawer} title="Team Menu">
        <div className="drawer-team-info">
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>{teamDisplayName}</div>
          {teamTag && (
            <div style={{ marginTop: 'var(--space-1)' }}>
              <Badge tone="yellow">{teamTag}</Badge>
            </div>
          )}
        </div>

        <nav className="drawer-nav" aria-label="Mobile Team Navigation">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={closeDrawer}>
              {link.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/admin" onClick={closeDrawer}>
              Admin Panel
            </NavLink>
          )}
          <NavLink to="/gallery" onClick={closeDrawer}>
            Gallery
          </NavLink>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
          <Button variant="secondary" block onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </MobileDrawer>

      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}

