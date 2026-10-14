import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DracordClient } from '@dracord/sdk';
import type { AuthTokens, PublicUser } from '@dracord/types';
import { API_URL } from './config';
import { syncStickersWithCloud } from './sticker-sync';

WebBrowser.maybeCompleteAuthSession();

const ACCESS_KEY = 'dracord.mobile.access';
const REFRESH_KEY = 'dracord.mobile.refresh';
const VOICE_CLIENT_KEY = 'dracord.voiceClientId';
const OAUTH_REDIRECT = 'dracord://oauth';

type AuthCtx = {
  client: DracordClient;
  user: PublicUser | null;
  ready: boolean;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setSession: (tokens: AuthTokens, user: PublicUser) => Promise<void>;
  refreshUser: () => Promise<PublicUser | null>;
};

const Ctx = createContext<AuthCtx | null>(null);

function parseOAuthUrl(url: string): AuthTokens | null {
  try {
    const parsed = new URL(url.replace(/^dracord:\/\//, 'https://oauth.local/'));
    const accessToken =
      parsed.searchParams.get('accessToken') ??
      new URLSearchParams(parsed.hash.replace(/^#/, '')).get('accessToken');
    const refreshToken =
      parsed.searchParams.get('refreshToken') ??
      new URLSearchParams(parsed.hash.replace(/^#/, '')).get('refreshToken');
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => new DracordClient(API_URL), []);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);
  const refreshMem = useRef<string | null>(null);

  const setSession = useCallback(
    async (tokens: AuthTokens, nextUser: PublicUser) => {
      refreshMem.current = tokens.refreshToken;
      await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
      client.setToken(tokens.accessToken);
      setUser(nextUser);
      client.connectSocket();
    },
    [client],
  );

  const applyOAuthTokens = useCallback(
    async (tokens: AuthTokens) => {
      client.setToken(tokens.accessToken);
      const me = await client.getMe();
      await setSession(tokens, me);
    },
    [client, setSession],
  );

  useEffect(() => {
    client.configureAuth({
      getRefreshToken: () => refreshMem.current,
      onTokensUpdated: (tokens) => {
        refreshMem.current = tokens.refreshToken;
        void SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
        void SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
        client.setToken(tokens.accessToken);
      },
    });
    void (async () => {
      try {
        let voiceId = await AsyncStorage.getItem(VOICE_CLIENT_KEY);
        if (!voiceId) {
          voiceId =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `vc-m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          await AsyncStorage.setItem(VOICE_CLIENT_KEY, voiceId);
        }
        client.setVoiceClient(voiceId, 'mobile');
      } catch {
        client.setVoiceClient(`vc-m-${Date.now()}`, 'mobile');
      }
      const access = await SecureStore.getItemAsync(ACCESS_KEY);
      const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
      refreshMem.current = refresh;
      if (!access) {
        setReady(true);
        return;
      }
      client.setToken(access);
      try {
        const me = await client.getMe();
        setUser(me);
        client.connectSocket();
      } catch {
        await SecureStore.deleteItemAsync(ACCESS_KEY);
        await SecureStore.deleteItemAsync(REFRESH_KEY);
        refreshMem.current = null;
        client.setToken(null);
      } finally {
        setReady(true);
      }
    })();
  }, [client]);

  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      if (!url.includes('oauth')) return;
      const tokens = parseOAuthUrl(url);
      if (tokens) void applyOAuthTokens(tokens);
    };
    const sub = Linking.addEventListener('url', onUrl);
    void Linking.getInitialURL().then((url) => {
      if (url) onUrl({ url });
    });
    return () => sub.remove();
  }, [applyOAuthTokens]);

  const loginGoogle = useCallback(async () => {
    const authUrl = client.getGoogleLoginUrl('mobile');
    const result = await WebBrowser.openAuthSessionAsync(authUrl, OAUTH_REDIRECT);
    if (result.type !== 'success' || !result.url) {
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      throw new Error('Google girişi tamamlanamadı');
    }
    const tokens = parseOAuthUrl(result.url);
    if (!tokens) throw new Error('OAuth token alınamadı');
    await applyOAuthTokens(tokens);
  }, [client, applyOAuthTokens]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await client.getMe();
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, [client]);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    refreshMem.current = null;
    client.setToken(null);
    client.socket?.disconnect();
    client.socket = null;
    setUser(null);
  }, [client]);

  useEffect(() => {
    if (!user) return;
    void syncStickersWithCloud(client);
  }, [client, user?.id]);

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
