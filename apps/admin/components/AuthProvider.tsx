'use client';

import type { PublicUser } from '@dracord/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getDracordClient } from '@/lib/client';
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  persistSession,
} from '@/lib/storage';

interface AuthContextValue {
  user: PublicUser | null;
  ready: boolean;
  loginDev: (username?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getDracordClient(), []);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  const hydrate = useCallback(async () => {
    const access = getAccessToken();
    const storedUser = getStoredUser();
    if (!access) {
      setUser(null);
      setReady(true);
      return;
    }
    client.setToken(access);
    if (storedUser) setUser(storedUser);
    try {
      const me = await client.getMe();
      setUser(me);
    } catch {
      clearSession();
      client.setToken(null);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, [client]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const loginDev = useCallback(
    async (username?: string) => {
      const result = await client.loginDev(username);
      persistSession(result.accessToken, result.refreshToken, result.user);
      client.setToken(result.accessToken);
      setUser(result.user);
    },
    [client],
  );

  const logout = useCallback(() => {
    clearSession();
    client.setToken(null);
    setUser(null);
  }, [client]);

  const value = useMemo(
    () => ({ user, ready, loginDev, logout }),
    [user, ready, loginDev, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
