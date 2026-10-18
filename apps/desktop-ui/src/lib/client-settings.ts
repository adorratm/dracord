import type { ClientSettings } from '@dracord/types';
import { configureUiTones } from '@/lib/sounds';

export const PREFS_STORAGE_KEY = 'dracord.userPreferences.v1';

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  privacy: {
    dmFilter: 'friends',
    allowFriendRequests: true,
    shareActivityStatus: true,
    dataCollection: false,
    personalizeAds: false,
    showBio: true,
    showSocialLinks: true,
    showBanner: true,
    showCustomStatus: true,
  },
  messaging: {
    whoCanDm: 'friends',
    filterExplicit: true,
    autoEmbed: true,
    spellcheck: true,
  },
  notifications: {
    desktopEnabled: true,
    pushEnabled: false,
    soundEnabled: true,
    uiToneVolume: 0.85,
    unreadBadge: true,
    mentionsOnly: false,
    quietHours: false,
    mutedUserIds: [],
    mutedChannelIds: [],
    mutedGuildIds: [],
  },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    messageGrouping: true,
    underlineLinks: false,
    roleColors: true,
  },
  appearance: {
    theme: 'dark',
    messageDensity: 'cozy',
    favoriteGuildIds: [],
    guildOrderIds: [],
    guildSkins: {},
  },
  system: {
    openOnStartup: false,
    hardwareAcceleration: true,
    minimizeToTray: true,
    autoUpdate: true,
  },
  language: {
    locale: 'tr',
    hour24: true,
  },
  activity: {
    displayActivity: true,
    shareGames: true,
    allowJoinRequests: true,
    shareSpotify: true,
    /** Desktop uygulamasında varsayılan açık — Steam/oyun “Oynuyor” */
    shareDesktopActivity: true,
  },
  developer: {
    developerMode: false,
    experimental: false,
  },
  family: {
    activitySummary: true,
    parentalControls: false,
    members: [],
    inviteCode: null,
  },
  security: {
    twoFactorEnabled: false,
    twoFactorSecret: null,
    recoveryCodes: [],
  },
  billing: {
    nitroPlan: 'none',
    nitroExpiresAt: null,
    boostCredits: 0,
    boostAssignments: [],
    gifts: [],
    paymentMethods: [],
    invoices: [],
  },
  connections: {
    apps: [],
  },
  avatar3d: {
    color: '#bd93f9',
    xp: 0,
    speed: 1,
    x: 0,
    z: 2.2,
  },
  stickers: {
    custom: [],
    favoriteIds: [],
    recentIds: [],
  },
};

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

export function mergeClientSettings(
  stored: Record<string, unknown> | null | undefined,
): ClientSettings {
  const base = structuredClone(DEFAULT_CLIENT_SETTINGS);
  if (!stored) return base;
  for (const key of Object.keys(base) as Array<keyof ClientSettings>) {
    const patch = stored[key as string];
    if (patch === undefined) continue;
    if (Array.isArray(patch)) {
      (base as unknown as Record<string, unknown>)[key as string] = patch;
      continue;
    }
    if (isObject(patch) && isObject(base[key] as unknown)) {
      const section = { ...(base[key] as object) } as Record<string, unknown>;
      for (const [sk, sv] of Object.entries(patch)) {
        section[sk] = sv;
      }
      (base as unknown as Record<string, unknown>)[key as string] = section;
    }
  }
  return base;
}

export function applyPrefsDom(prefs: ClientSettings) {
  const root = document.documentElement;
  root.classList.toggle('dark', prefs.appearance.theme !== 'light');
  root.classList.toggle('light', prefs.appearance.theme === 'light');
  root.classList.toggle('reduce-motion', prefs.accessibility.reducedMotion);
  root.classList.toggle('high-contrast', prefs.accessibility.highContrast);
  root.classList.toggle('underline-links', prefs.accessibility.underlineLinks);
  root.classList.toggle('no-hw-accel', !prefs.system.hardwareAcceleration);
  root.classList.toggle('experimental-ui', prefs.developer.experimental);
  root.lang = prefs.language.locale === 'en' ? 'en' : 'tr';
  configureUiTones({
    enabled: prefs.notifications.soundEnabled !== false,
    volume: prefs.notifications.uiToneVolume ?? 0.85,
  });
}

export function loadLocalPrefs(): ClientSettings {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_CLIENT_SETTINGS;
    return mergeClientSettings(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return DEFAULT_CLIENT_SETTINGS;
  }
}

export function saveLocalPrefs(prefs: ClientSettings) {
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  applyPrefsDom(prefs);
}

/** Electron main: başlangıçta aç + tepsi + autoUpdate — OS login item / autostart */
export function syncDesktopSystemPrefs(
  system: Pick<
    ClientSettings['system'],
    'openOnStartup' | 'minimizeToTray' | 'autoUpdate'
  >,
) {
  const api = typeof window !== 'undefined' ? window.dracordDesktop : undefined;
  if (!api?.setSystemPrefs) return;
  void Promise.resolve(
    api.setSystemPrefs({
      openOnStartup: Boolean(system.openOnStartup),
      minimizeToTray: Boolean(system.minimizeToTray),
      autoUpdate: system.autoUpdate !== false,
    }),
  ).catch(() => undefined);
}
