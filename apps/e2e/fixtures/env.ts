import fs from 'node:fs';
import path from 'node:path';

export const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const API_URL = (process.env.E2E_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const AUTH_DIR = path.join(__dirname, '..', '.auth');
export const STATE_FILE = path.join(AUTH_DIR, 'state.json');
const REFRESH_FILE = path.join(AUTH_DIR, 'refresh-token');
const ACCESS_FILE = path.join(AUTH_DIR, 'access-token');

export function savedRefreshToken(): string | null {
  try {
    const t = fs.readFileSync(REFRESH_FILE, 'utf8').trim();
    if (t) return t;
  } catch {
    /* yok */
  }
  return process.env.E2E_REFRESH_TOKEN?.trim() || null;
}

export function saveTokens(access: string, refresh: string) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(REFRESH_FILE, refresh, { mode: 0o600 });
  fs.writeFileSync(ACCESS_FILE, access, { mode: 0o600 });
}

export function accessToken(): string {
  return fs.readFileSync(ACCESS_FILE, 'utf8').trim();
}

/** "<guildId>/<channelId>" */
export function testChannel(): { guildId: string; channelId: string } | null {
  const raw = process.env.E2E_CHANNEL?.trim();
  if (!raw) return null;
  const [guildId, channelId] = raw.replace(/^\/?channels\//, '').split('/');
  return guildId && channelId ? { guildId, channelId } : null;
}

export function hasSession(): boolean {
  return fs.existsSync(STATE_FILE) && fs.existsSync(ACCESS_FILE);
}
