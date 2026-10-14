import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DracordClient, SocketEvents } from '@dracord/sdk';
import type { AuthTokens, PublicUser } from '@dracord/types';
import {
  applyStickerCloudState,
  pullStickersFromCloud,
  setStickerCloudBridge,
} from '@dracord/ui';
import { API_URL } from './config';
import { mergeClientSettings } from './lib/client-settings';

const ACCESS_KEY = 'dracord.desktop.access';
const REFRESH_KEY = 'dracord.desktop.refresh';

type AuthCtx = {
  client: DracordClient;
  user: PublicUser | null;
  ready: boolean;
  loginGoogle: () => void;
  logout: () => void;
  setSession: (tokens: AuthTokens, user: PublicUser) => void;
  refreshUser: () => Promise<PublicUser | null>;
  setUser: (user: PublicUser | null | ((prev: PublicUser | null) => PublicUser | null)) => void;
  updatePresence: (data: {
    status: PublicUser['status'];
    customStatus?: string | null;
  }) => Promise<PublicUser | null>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => new DracordClient(API_URL), []);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  const setSession = useCallback(
    (tokens: AuthTokens, nextUser: PublicUser) => {
      localStorage.setItem(ACCESS_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
      client.setToken(tokens.accessToken);
      setUser(nextUser);
      client.connectSocket();
    },
    [client],
  );

  useEffect(() => {
    client.configureAuth({
      getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
      onTokensUpdated: (tokens) => {
        localStorage.setItem(ACCESS_KEY, tokens.accessToken);
        localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
        client.setToken(tokens.accessToken);
      },
    });
    const access = localStorage.getItem(ACCESS_KEY);
    if (!access) {
      setReady(true);
      return;
    }
    client.setToken(access);
    void client
      .getMe()
      .then((me) => {
        setUser(me);
        client.connectSocket();
      })
      .catch(() => {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        client.setToken(null);
      })
      .finally(() => setReady(true));
  }, [client]);

  const loginGoogle = useCallback(() => {
    window.location.href = client.getGoogleLoginUrl('desktop');
  }, [client]);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    client.setToken(null);
    client.socket?.disconnect();
    client.socket = null;
    setStickerCloudBridge(null);
    setUser(null);
  }, [client]);

  useEffect(() => {
    if (!user) {
      setStickerCloudBridge(null);
      return;
    }
    setStickerCloudBridge({
      get: async () => {
        const remote = await client.getClientSettings();
        const merged = mergeClientSettings(remote as unknown as Record<string, unknown>);
        return merged.stickers ?? null;
      },
      set: async (state) => {
        await client.updateClientSettings({ stickers: state });
      },
    });
    void client
      .getClientSettings()
      .then((remote) => {
        const merged = mergeClientSettings(remote as unknown as Record<string, unknown>);
        applyStickerCloudState(merged.stickers);
        void pullStickersFromCloud();
      })
      .catch(() => undefined);
    return () => setStickerCloudBridge(null);
  }, [client, user?.id]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await client.getMe();
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, [client]);

  const updatePresence = useCallback(
    async (data: { status: PublicUser['status']; customStatus?: string | null }) => {
      try {
        const me = await client.updatePresence(data);
        setUser(me);
        return me;
      } catch {
        return null;
      }
    },
    [client],
  );

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onPresence = (payload: {
      userId: string;
      status: PublicUser['status'];
      customStatus?: string | null;
    }) => {
      if (payload.userId !== user.id) return;
      if (payload.status === 'OFFLINE' && sock.connected) return;
      setUser((prev) =>
        prev
          ? {
              ...prev,
              status: payload.status,
              customStatus:
                payload.customStatus !== undefined ? payload.customStatus : prev.customStatus,
            }
          : prev,
      );
    };
    sock.on(SocketEvents.PRESENCE_UPDATE, onPresence);
    return () => {
      sock.off(SocketEvents.PRESENCE_UPDATE, onPresence);
    };
  }, [client, user?.id]);

  const value = useMemo(
    () => ({
      client,
      user,
      ready,
      loginGoogle,
      logout,
      setSession,
      refreshUser,
      setUser,
      updatePresence,
    }),
    [client, user, ready, loginGoogle, logout, setSession, refreshUser, updatePresence],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider gerekli');
  return v;
}
