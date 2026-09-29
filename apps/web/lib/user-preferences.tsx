'use client';

import type { ClientSettings } from '@dracord/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/components/AuthProvider';
import { DEFAULT_CLIENT_SETTINGS, mergeClientSettings } from '@/lib/client-settings-defaults';

const STORAGE_KEY = 'dracord.userPreferences.v1';

export type UserPreferences = ClientSettings;
export const DEFAULT_PREFERENCES = DEFAULT_CLIENT_SETTINGS;

function loadLocal(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return mergeClientSettings(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function saveLocal(prefs: UserPreferences) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function applyDomClasses(prefs: UserPreferences) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', prefs.appearance.theme !== 'light');
  root.classList.toggle('light', prefs.appearance.theme === 'light');
  root.classList.toggle('reduce-motion', prefs.accessibility.reducedMotion);
  root.classList.toggle('high-contrast', prefs.accessibility.highContrast);
  root.classList.toggle('underline-links', prefs.accessibility.underlineLinks);
  root.classList.toggle('no-hw-accel', !prefs.system.hardwareAcceleration);
  root.classList.toggle('experimental-ui', prefs.developer.experimental);
  root.lang = prefs.language.locale === 'en' ? 'en' : 'tr';

  const desktop = (
    window as Window & {
      dracordDesktop?: { setSystemPrefs?: (p: UserPreferences['system']) => void };
    }
  ).dracordDesktop;
  desktop?.setSystemPrefs?.(prefs.system);
}

function mergePrefs(
  base: UserPreferences,
  patch: Partial<UserPreferences>,
): UserPreferences {
  return mergeClientSettings({
    ...base,
    ...patch,
    privacy: { ...base.privacy, ...(patch.privacy ?? {}) },
    messaging: { ...base.messaging, ...(patch.messaging ?? {}) },
    notifications: { ...base.notifications, ...(patch.notifications ?? {}) },
    accessibility: { ...base.accessibility, ...(patch.accessibility ?? {}) },
    appearance: { ...base.appearance, ...(patch.appearance ?? {}) },
    system: { ...base.system, ...(patch.system ?? {}) },
    language: { ...base.language, ...(patch.language ?? {}) },
    activity: { ...base.activity, ...(patch.activity ?? {}) },
    developer: { ...base.developer, ...(patch.developer ?? {}) },
    family: { ...base.family, ...(patch.family ?? {}) },
    security: { ...base.security, ...(patch.security ?? {}) },
    billing: { ...base.billing, ...(patch.billing ?? {}) },
    connections: { ...base.connections, ...(patch.connections ?? {}) },
  } as unknown as Record<string, unknown>);
}

type PrefsContextValue = {
  prefs: UserPreferences;
  ready: boolean;
  update: (patch: Partial<UserPreferences>) => void;
  setSection: <K extends keyof UserPreferences>(
    key: K,
    value: Partial<UserPreferences[K]> | UserPreferences[K],
  ) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { client, user, ready: authReady } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const local = loadLocal();
    setPrefs(local);
    applyDomClasses(local);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;
    void client
      .getClientSettings()
      .then((remote) => {
        if (cancelled) return;
        const next = mergeClientSettings(remote as unknown as Record<string, unknown>);
        setPrefs(next);
        saveLocal(next);
        applyDomClasses(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authReady, user?.id, client]);

  useEffect(() => {
    if (!ready) return;
    applyDomClasses(prefs);
  }, [prefs, ready]);

  const update = useCallback(
    (patch: Partial<UserPreferences>) => {
      setPrefs((prev) => {
        const next = mergePrefs(prev, patch);
        saveLocal(next);
        applyDomClasses(next);
        if (user) {
          void client.updateClientSettings(patch).catch(() => undefined);
        }
        return next;
      });
    },
    [client, user],
  );

  const setSection = useCallback(
    <K extends keyof UserPreferences>(
      key: K,
      value: Partial<UserPreferences[K]> | UserPreferences[K],
    ) => {
      update({ [key]: value } as Partial<UserPreferences>);
    },
    [update],
  );

  const value = useMemo(
    () => ({ prefs, ready, update, setSection }),
    [prefs, ready, update, setSection],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function useUserPreferences(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) {
    throw new Error('useUserPreferences PreferencesProvider içinde kullanılmalıdır');
  }
  return ctx;
}
