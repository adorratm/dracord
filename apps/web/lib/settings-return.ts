const SETTINGS_KEY = 'dracord:settings-return';
const DM_KEY = 'dracord:dm-return';
const LAST_CHANNEL_KEY = 'dracord:last-channel';

const SKIP_PREFIXES = [
  '/settings',
  '/login',
  '/register',
  '/onboarding',
  '/auth',
  '/invite',
];

function shouldRemember(pathname: string): boolean {
  if (!pathname || pathname === '/') return false;
  return !SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** /channels/me/:id veya /channels/@me/:id — açık DM konuşması */
export function isDmConversationPath(pathname: string): boolean {
  return /^\/channels\/(?:@me|me)\/[^/]+/.test(pathname);
}

function isValidReturnPath(pathname: string): boolean {
  return shouldRemember(pathname) || pathname === '/channels/@me' || pathname === '/channels/me';
}

export function rememberSettingsReturnPath(pathname: string): void {
  if (typeof window === 'undefined') return;
  if (!shouldRemember(pathname)) return;
  try {
    sessionStorage.setItem(SETTINGS_KEY, pathname);
  } catch {
    // ignore
  }
}

/** DM konuşmasına girilirken, geldiğimiz (konuşma dışı) sayfayı kaydet */
export function rememberDmReturnPath(fromPathname: string): void {
  if (typeof window === 'undefined') return;
  if (!fromPathname || isDmConversationPath(fromPathname)) return;
  if (!isValidReturnPath(fromPathname)) return;
  try {
    sessionStorage.setItem(DM_KEY, fromPathname);
  } catch {
    // ignore
  }
}

function readLastChannelPath(): string | null {
  try {
    const raw = localStorage.getItem(LAST_CHANNEL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { guildId?: string; channelId?: string };
    if (parsed.guildId && parsed.channelId) {
      return `/channels/${parsed.guildId}/${parsed.channelId}`;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getSettingsReturnPath(fallback = '/channels/@me'): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(SETTINGS_KEY);
    if (raw && shouldRemember(raw)) return raw;
  } catch {
    // ignore
  }
  return readLastChannelPath() ?? fallback;
}

export function getDmReturnPath(fallback = '/channels/@me'): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(DM_KEY);
    if (raw && !isDmConversationPath(raw) && isValidReturnPath(raw)) return raw;
  } catch {
    // ignore
  }
  return readLastChannelPath() ?? fallback;
}
