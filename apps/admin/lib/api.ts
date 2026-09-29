import type { GuildSummary, PublicUser } from '@dracord/types';
import { getApiBaseUrl } from '@/lib/client';
import { getAccessToken } from '@/lib/storage';

async function adminFetch<T>(path: string): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function searchUsers(q: string): Promise<PublicUser[]> {
  const query = encodeURIComponent(q.trim());
  return adminFetch(`/users/search?q=${query}`);
}

export function listGuilds(): Promise<GuildSummary[]> {
  return adminFetch('/guilds');
}
