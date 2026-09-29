'use client';

import type { AuthTokens, PublicUser } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DracordClient } from '@dracord/sdk';
import { getDracordClient } from '@/lib/client';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  persistSession,
} from '@/lib/storage';

interface AuthContextValue {
  user: PublicUser | null;
  client: DracordClient;
  ready: boolean;
  loginDev: (username?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: PublicUser | null) => void;
  refreshUser: () => Promise<PublicUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Access JWT ~7g; proaktif yenileme aralığı */
const PROACTIVE_REFRESH_MS = 6 * 60 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getDracordClient(), []);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    client.setToken(null);
    client.socket?.disconnect();
    clearSession();
    setUser(null);
  }, [client]);

  const applyTokens = useCallback(
    (accessToken: string, refreshToken?: string, nextUser?: PublicUser | null) => {
      client.setToken(accessToken);
      client.connectSocket();
      if (refreshToken && nextUser) {
        persistSession(accessToken, refreshToken, nextUser);
      } else if (refreshToken) {
        const existing = getStoredUser();
        if (existing) persistSession(accessToken, refreshToken, existing);
      }
    },
    [client],
  );

  useEffect(() => {
    client.configureAuth({
      getRefreshToken,
      onTokensUpdated: (tokens: AuthTokens) => {
        const existing = getStoredUser();
        if (existing) {
          persistSession(tokens.accessToken, tokens.refreshToken, existing);
        } else {
          localStorage.setItem('dracord_access_token', tokens.accessToken);
          localStorage.setItem('dracord_refresh_token', tokens.refreshToken);
        }
        client.setToken(tokens.accessToken);
      },
    });
  }, [client]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await client.getMe();
      setUser(me);
      const access = getAccessToken();
      const refresh = getRefreshToken();
      if (access && refresh) persistSession(access, refresh, me);
      return me;
    } catch {
      return null;
    }
  }, [client]);

  const hydrate = useCallback(async () => {
    const access = getAccessToken();
    const refresh = getRefreshToken();
    const storedUser = getStoredUser();

    if (!access && !refresh) {
      setUser(null);
      setReady(true);
      return;
    }

    if (access) {
      applyTokens(access);
      if (storedUser) setUser(storedUser);
    }

    try {
      if (access) {
        const me = await client.getMe();
        setUser(me);
        if (refresh) persistSession(access, refresh, me);
        setReady(true);
        return;
      }
    } catch {
      // try refresh below
    }

    if (refresh) {
      try {
        const tokens = await client.refresh(refresh);
        applyTokens(tokens.accessToken, tokens.refreshToken, storedUser ?? undefined);
        const me = await client.getMe();
        setUser(me);
        persistSession(tokens.accessToken, tokens.refreshToken, me);
        setReady(true);
        return;
      } catch {
        logout();
        setReady(true);
        return;
      }
    }

    logout();
    setReady(true);
  }, [applyTokens, client, logout]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Proaktif token yenileme
  useEffect(() => {
    if (!ready || !user) return;
    const tick = () => {
      const refresh = getRefreshToken();
      if (!refresh) return;
      void client.refresh(refresh).then((tokens) => {
        applyTokens(tokens.accessToken, tokens.refreshToken);
        const existing = getStoredUser();
        if (existing) persistSession(tokens.accessToken, tokens.refreshToken, existing);
      }).catch(() => undefined);
    };
    const id = window.setInterval(tick, PROACTIVE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [ready, user, client, applyTokens]);

  // Presence socket güncellemesi
  useEffect(() => {
    if (!ready || !user?.id) return;
    const userId = user.id;
    const sock = client.connectSocket();
    const onPresence = (payload: {
      userId: string;
      status: PublicUser['status'];
      customStatus?: string | null;
    }) => {
      if (payload.userId !== userId) return;
      setUser((prev) =>
        prev
          ? {
              ...prev,
              status: payload.status,
              customStatus:
                payload.customStatus !== undefined
                  ? payload.customStatus
                  : prev.customStatus,
            }
          : prev,
      );
    };
    const onConnect = () => {
      // Soket bağlanınca UI'ı hemen çevrimiçi göster (sunucu event'i gelene kadar)
      setUser((prev) => {
        if (!prev) return prev;
        if (prev.status === 'IDLE' || prev.status === 'DND') return prev;
        if (prev.status === 'ONLINE') return prev;
        return { ...prev, status: 'ONLINE' };
      });
    };
    sock.on(SocketEvents.PRESENCE_UPDATE, onPresence);
    sock.on('connect', onConnect);
    if (sock.connected) onConnect();
    return () => {
      sock.off(SocketEvents.PRESENCE_UPDATE, onPresence);
      sock.off('connect', onConnect);
    };
  }, [ready, user?.id, client]);

  const loginDev = useCallback(
    async (username?: string) => {
      const result = await client.loginDev(username);
      persistSession(result.accessToken, result.refreshToken, result.user);
      applyTokens(result.accessToken, result.refreshToken, result.user);
      setUser(result.user);
    },
    [applyTokens, client],
  );

  const value = useMemo(
    () => ({ user, client, ready, loginDev, logout, setUser, refreshUser }),
    [user, client, ready, loginDev, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth AuthProvider içinde kullanılmalıdır');
  }
  return ctx;
}
