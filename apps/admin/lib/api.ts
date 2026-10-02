import type { ChannelSummary, GuildSummary, PublicUser, VoiceMemberSummary } from '@dracord/types';
import { getApiBaseUrl } from '@/lib/client';
import { getAccessToken } from '@/lib/storage';

export type PlatformAdminGuildDetail = GuildSummary & {
  memberCount: number;
  channelCount: number;
};

export type PlatformAdminMessageRow = {
  id: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type PlatformAdminVoiceRow = {
  channelId: string;
  channelName: string;
  members: VoiceMemberSummary[];
  screenSharers: VoiceMemberSummary[];
};

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

/** @deprecated üyelik listesi — platform-admin/guilds kullan */
export function listGuilds(): Promise<GuildSummary[]> {
  return adminFetch('/guilds');
}

export function listAllGuilds(): Promise<PlatformAdminGuildDetail[]> {
  return adminFetch('/platform-admin/guilds');
}

export function getGuildDetail(guildId: string): Promise<PlatformAdminGuildDetail> {
  return adminFetch(`/platform-admin/guilds/${guildId}`);
}

export function listGuildChannels(guildId: string): Promise<ChannelSummary[]> {
  return adminFetch(`/platform-admin/guilds/${guildId}/channels`);
}

export function listGuildMembers(guildId: string): Promise<PublicUser[]> {
  return adminFetch(`/platform-admin/guilds/${guildId}/members`);
}

export function listGuildMessages(
  guildId: string,
  limit = 50,
): Promise<PlatformAdminMessageRow[]> {
  return adminFetch(`/platform-admin/guilds/${guildId}/messages?limit=${limit}`);
}

export function listGuildVoice(guildId: string): Promise<PlatformAdminVoiceRow[]> {
  return adminFetch(`/platform-admin/guilds/${guildId}/voice`);
}
