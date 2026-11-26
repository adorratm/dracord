import { useEffect, useState } from 'react';
import type { ClientSettings } from '@dracord/types';
import { NotificationBell as SharedNotificationBell } from '@dracord/ui';
import { useAuth } from '../auth';
import { DEFAULT_CLIENT_SETTINGS, mergeClientSettings } from '../lib/client-settings';

const STORAGE_KEY = 'dracord.userPreferences.v1';

function loadPrefs(): ClientSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CLIENT_SETTINGS;
    return mergeClientSettings(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return DEFAULT_CLIENT_SETTINGS;
  }
}

/** Gelen kutusu — ortak bileşen @dracord/ui'da; desktop tercihleri yerel depodan okur */
export function NotificationBell({
  onOpenAll,
  onOpenSettings,
  onNavigateLink,
}: {
  onOpenAll?: () => void;
  onOpenSettings?: () => void;
  onNavigateLink?: (link: string) => void;
}) {
  const { client, user, ready } = useAuth();
  const [prefs, setPrefs] = useState(loadPrefs);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPrefs(loadPrefs());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return (
    <SharedNotificationBell
      client={client}
      user={user}
      ready={ready}
      prefs={prefs}
      readPrefs={loadPrefs}
      onOpen={() => setPrefs(loadPrefs())}
      onNavigateLink={(link) => onNavigateLink?.(link)}
      onOpenSettings={() => onOpenSettings?.()}
      onOpenAll={onOpenAll}
    />
  );
}
