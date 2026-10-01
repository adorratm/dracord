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
      setUser((prev) => {
        if (
          client.socket?.connected &&
          me.status === 'OFFLINE' &&
          prev &&
          (prev.status === 'ONLINE' || prev.status === 'IDLE' || prev.status === 'DND')
        ) {
          return { ...me, status: prev.status, customStatus: prev.customStatus ?? me.customStatus };
        }
        if (client.socket?.connected && me.status === 'OFFLINE') {
          return { ...me, status: 'ONLINE' };
        }
        return me;
      });
      const access = getAccessToken();
      const refresh = getRefreshToken();
      if (access && refresh) {
        const next =
          client.socket?.connected && me.status === 'OFFLINE'
            ? { ...me, status: 'ONLINE' as const }
            : me;
        persistSession(access, refresh, next);
      }
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
        const live =
          client.socket?.connected && me.status === 'OFFLINE'
            ? { ...me, status: 'ONLINE' as const }
            : me;
        setUser(live);
        if (refresh) persistSession(access, refresh, live);
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
      // Bu sekme açıkken kendini çevrimdışı gösterme (sayfa geçişi / reconnect race)
      if (payload.status === 'OFFLINE') return;
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
      setUser((prev) => {
        if (!prev) return prev;
        if (prev.status === 'IDLE' || prev.status === 'DND') return prev;
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
      if ('requires2fa' in result && result.requires2fa) {
        throw new Error('2FA_REQUIRED:' + result.challengeToken);
      }
      if (!('accessToken' in result)) {
        throw new Error('Giriş başarısız');
      }
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
