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
import type { AuthTokens, PublicUser } from '@dracord/types';
import { API_URL } from './config';

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
    setUser(null);
  }, [client]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await client.getMe();
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, [client]);

  const value = useMemo(
    () => ({ client, user, ready, loginGoogle, logout, setSession, refreshUser }),
    [client, user, ready, loginGoogle, logout, setSession, refreshUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider gerekli');
  return v;
}
