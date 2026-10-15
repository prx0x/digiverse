import { createContext } from 'react';
import type { AuthUser } from '@/api/auth';

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
