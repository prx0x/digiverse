import { useEffect, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Panel,
  Table,
} from '@/components';
import { ApiError } from '@/api/client';
import {
  adminCreateTeamApi,
  adminDisableTeamApi,
  adminEnableTeamApi,
  adminListTeamsApi,
  adminResetTeamPasswordApi,
  type AdminTeamItem,
} from '@/api/auth';

export function AdminTeamsPage() {
  const [teams, setTeams] = useState<AdminTeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [resetTarget, setResetTarget] = useState<AdminTeamItem | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setTeams(await adminListTeamsApi());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setError(null);
    try {
      await adminCreateTeamApi({
        identifier: identifier.trim(),
        name: name.trim(),
        tag: tag.trim() || undefined,
        password,
      });
      setIdentifier('');
      setName('');
      setTag('');
      setPassword('');
      setNotice('Team created.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEnabled(team: AdminTeamItem) {
    setError(null);
    try {
      const next = team.enabled
        ? await adminDisableTeamApi(team.id)
        : await adminEnableTeamApi(team.id);
      setTeams((current) => current.map((t) => (t.id === next.id ? { ...t, ...next } : t)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  async function confirmReset() {
    if (!resetTarget) return;
    setError(null);
    try {
      await adminResetTeamPasswordApi(resetTarget.id, resetPassword);
      setNotice(`Password reset for ${resetTarget.name}.`);
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed');
    }
  }

  if (loading) return <LoadingState title="Loading teams" description="Fetching registered accounts." />;
  if (error && teams.length === 0) {
    return <ErrorState title="Could not load teams" description={error} actionLabel="Retry" onAction={() => void load()} />;
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Badge tone="blue">LIVE</Badge>
          <h1 className="page-header__title">Teams</h1>
          <p className="page-header__meta">Admin-provisioned accounts only — no public registration.</p>
        </div>
      </header>

      {error ? (
        <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" style={{ color: 'var(--color-blue)', fontWeight: 600 }}>
          {notice}
        </p>
      ) : null}

      <Panel title="Create team" accent="blue">
        <form className="stack" onSubmit={onCreate}>
          <div className="form-grid">
            <Input
              id="team-identifier"
              label="Login identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="off"
            />
            <Input
              id="team-name"
              label="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input id="team-tag" label="Tag (optional)" value={tag} onChange={(e) => setTag(e.target.value)} />
            <Input
              id="team-password"
              label="Initial password (min 8)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create team'}
          </Button>
        </form>
      </Panel>

      <Panel title="Registered teams">
        {teams.length === 0 ? (
          <EmptyState title="No teams yet" description="Create the first team account above." />
        ) : (
          <Table headers={['Name', 'Identifier', 'Tag', 'Status', 'Actions']} caption="Team accounts">
            {teams.map((team) => (
              <tr key={team.id}>
                <td>{team.name}</td>
                <td>{team.identifier}</td>
                <td>{team.tag || '—'}</td>
                <td>{team.enabled ? 'Enabled' : 'Disabled'}</td>
                <td>
                  <div className="row">
                    <Button variant="secondary" onClick={() => void toggleEnabled(team)}>
                      {team.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setResetTarget(team);
                        setResetPassword('');
                      }}
                    >
                      Reset password
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Modal
        open={Boolean(resetTarget)}
        title={`Reset password${resetTarget ? ` — ${resetTarget.name}` : ''}`}
        confirmLabel="Reset"
        onClose={() => setResetTarget(null)}
        onConfirm={() => void confirmReset()}
      >
        <Input
          id="reset-password"
          label="New password (min 8)"
          type="password"
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
          minLength={8}
          autoComplete="new-password"
        />
      </Modal>
    </div>
  );
}
