const KEY = 'dracord:settings-return';
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

export function rememberSettingsReturnPath(pathname: string): void {
  if (typeof window === 'undefined') return;
  if (!shouldRemember(pathname)) return;
  try {
    sessionStorage.setItem(KEY, pathname);
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
    const raw = sessionStorage.getItem(KEY);
    if (raw && shouldRemember(raw)) return raw;
  } catch {
    // ignore
  }
  return readLastChannelPath() ?? fallback;
}
