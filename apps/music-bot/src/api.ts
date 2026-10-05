import type { MusicJobPayload, MusicQueueState, MusicTrack } from '@dracord/types';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const SECRET = process.env.MUSIC_BOT_INTERNAL_SECRET?.trim() ?? '';

function requireSecret(): string {
  if (
    !SECRET ||
    SECRET.length < 24 ||
    SECRET === 'dracord-music-dev' ||
    SECRET === 'change-me'
  ) {
    throw new Error(
      'MUSIC_BOT_INTERNAL_SECRET eksik veya zayıf (min 24 karakter, örnek secret kullanma)',
    );
  }
  return SECRET;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-music-bot-secret': requireSecret(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export function getState(guildId: string, voiceChannelId: string) {
  return api<MusicQueueState | null>('/internal/music/state', { guildId, voiceChannelId });
}

export function getToken(channelId: string) {
  return api<{ token: string; url: string; roomName: string; botUserId: string }>(
    '/internal/music/token',
    { channelId },
  );
}

export function presenceJoin(guildId: string, channelId: string) {
  return api('/internal/music/presence/join', { guildId, channelId });
}

export function presenceLeave(guildId: string, channelId: string) {
  return api('/internal/music/presence/leave', { guildId, channelId });
}

export function trackEnded(payload: {
  guildId: string;
  voiceChannelId: string;
  textChannelId?: string;
}) {
  return api<{ ok: boolean; empty: boolean; track?: MusicTrack }>('/internal/music/track-ended', payload);
}

export function trackMeta(payload: {
  guildId: string;
  voiceChannelId: string;
  trackId: string;
  title?: string;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  webpageUrl?: string | null;
}) {
  return api('/internal/music/track-meta', payload);
}

export function presenceHeartbeat(guildId: string, channelId: string) {
  return api('/internal/music/presence/heartbeat', { guildId, channelId });
}

export function announce(textChannelId: string, content: string) {
  return api('/internal/music/announce', { textChannelId, content });
}

export type { MusicJobPayload, MusicQueueState, MusicTrack };
