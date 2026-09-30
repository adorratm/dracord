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
  setUser: (user: PublicUser | null) => void;
  loginWithGoogle: () => void;
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
      const me = await client.getAdminMe();
      setUser(me);
      persistSession(access, undefined, me);
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

  const loginWithGoogle = useCallback(() => {
    window.location.href = client.getGoogleLoginUrl('admin');
  }, [client]);

  const logout = useCallback(() => {
    clearSession();
    client.setToken(null);
    setUser(null);
  }, [client]);

  const value = useMemo(
    () => ({ user, ready, setUser, loginWithGoogle, logout }),
    [user, ready, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
