import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getMeApi,
  loginApi,
  logoutApi,
  type AuthUser,
} from '@/api/auth';
import { clearCachedCsrfToken } from '@/api/client';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await getMeApi();
      setUser(me);
      setError(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const authenticatedUser = await loginApi({ identifier, password });
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Even if network fails, clear local state
    } finally {
      clearCachedCsrfToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
