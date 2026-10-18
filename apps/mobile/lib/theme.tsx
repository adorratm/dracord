import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  palettes,
  setThemeMode,
  type AppColors,
  type ThemeMode,
} from '@dracord/app-theme';
import { useAuth } from './auth';
import { setAppLocale } from './i18n';
import { useThemeRevision } from './theme-revision';

type ThemeCtxValue = {
  mode: ThemeMode;
  colors: AppColors;
  setMode: (mode: ThemeMode) => void;
};

const ThemeCtx = createContext<ThemeCtxValue>({
  mode: 'dark',
  colors: palettes.dark,
  setMode: () => undefined,
});

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { client, user } = useAuth();
  const mode = useThemeRevision();

  useEffect(() => {
    if (!user) return;
    void client
      .getClientSettings()
      .then((s) => {
        setThemeMode(s.appearance?.theme === 'light' ? 'light' : 'dark');
        setAppLocale(s.language?.locale === 'en' ? 'en' : 'tr');
      })
      .catch(() => undefined);
  }, [client, user?.id]);

  const setMode = useCallback((next: ThemeMode) => {
    setThemeMode(next);
  }, []);

  const value = useMemo<ThemeCtxValue>(
    () => ({
      mode,
      colors: palettes[mode],
      setMode,
    }),
    [mode, setMode],
  );

  return (
    <ThemeCtx.Provider value={value}>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      {children}
    </ThemeCtx.Provider>
  );
}

export { useThemeRevision } from './theme-revision';
