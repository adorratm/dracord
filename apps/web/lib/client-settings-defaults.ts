import type { ClientSettings } from '@dracord/types';

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
