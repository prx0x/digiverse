import { useState, type FormEvent, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Input } from '@/components';
import { useAuth } from '@/context';
import { ApiError } from '@/api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else {
        navigate(user.role === 'admin' ? '/admin' : '/team', { replace: true });
      }
    }
  }, [user, navigate, location]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const authUser = await login(identifier.trim(), password);
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else {
        navigate(authUser.role === 'admin' ? '/admin' : '/team', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setErrorMessage('Invalid credentials or account is disabled.');
        } else if (err.statusCode === 429) {
          setErrorMessage('Too many failed attempts. Please try again later.');
        } else {
          setErrorMessage(err.message || 'Login failed. Please check your connection.');
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unexpected login error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} aria-labelledby="login-title">
      <div className="stack">
        <Badge tone="blue">AUTHENTICATION</Badge>
        <h1 id="login-title">Portal sign-in</h1>
        <p>
          Organiser and team authentication. Accounts are provisioned by organisers — no public registration.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-panel)',
            borderLeft: '4px solid var(--color-red)',
            color: 'var(--color-red)',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {errorMessage}
        </div>
      )}

      <Input
        id="login-id"
        label="Account identifier"
        autoComplete="username"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        required
        disabled={submitting}
      />
      <Input
        id="login-password"
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={submitting}
      />
      <Button type="submit" block disabled={submitting}>
        {submitting ? 'Authenticating...' : 'Sign in'}
      </Button>
    </form>
  );
}
