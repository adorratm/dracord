import { useSyncExternalStore } from 'react';
import { getThemeMode, subscribeTheme, type ThemeMode } from '@dracord/app-theme';

/** Memo satırlarda tema değişimini tetikler — auth cycle yok */
export function useThemeRevision(): ThemeMode {
  return useSyncExternalStore(subscribeTheme, getThemeMode, getThemeMode);
}
