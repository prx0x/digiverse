import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { AuthProvider } from '@/context';
import * as authApi from '@/api/auth';
import { ApiError } from '@/api/client';

afterEach(() => {
  cleanup();
});

vi.mock('@/api/auth', () => ({
  getMeApi: vi.fn().mockRejectedValue(new Error('Unauthenticated')),
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
}));

describe('LoginPage component', () => {
  it('renders login fields, badges, and organizer information', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /portal sign-in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/account identifier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('displays error message when login fails with 401', async () => {
    vi.mocked(authApi.loginApi).mockRejectedValueOnce(
      new ApiError(401, 'UNAUTHORIZED', 'Invalid credentials'),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/account identifier/i), {
      target: { value: 'bad_user' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong_password' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invalid credentials or account is disabled/i),
      ).toBeInTheDocument();
    });
  });
});
