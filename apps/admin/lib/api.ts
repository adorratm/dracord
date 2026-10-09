import type {
  ChannelSummary,
  GuildSummary,
  PublicUser,
  RoleDto,
  SearchResponse,
  VoiceMemberSummary,
} from '@dracord/types';
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
  threadRootId?: string | null;
  type?: string;
  attachments?: Array<{
    id: string;
    url: string;
    filename: string;
    contentType: string;
    size: number;
  }>;
  embeds?: Array<{
    url: string;
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    siteName?: string | null;
  }>;
  poll?: {
    question: string;
    options: Array<{ id: string; text: string }>;
    multi: boolean;
    closed?: boolean;
  } | null;
};

export type PlatformAdminVoiceRow = {
  channelId: string;
  channelName: string;
  members: VoiceMemberSummary[];
  screenSharers: VoiceMemberSummary[];
};

async function adminFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    body:
      init?.json !== undefined
        ? JSON.stringify(init.json)
        : init?.body,
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type PlatformAdminUserRow = PublicUser & {
  email: string;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  isPlatformAdmin: boolean;
  guildCount: number;
};

export type PlatformAdminUserDetail = PlatformAdminUserRow & {
  bio: string | null;
  bannerUrl: string | null;
  bannerColor: string | null;
  guilds: Array<{
    id: string;
    name: string;
    owner: boolean;
    timeoutUntil: string | null;
    banned: boolean;
  }>;
  sessionCount: number;
};

export function searchUsers(q: string): Promise<PublicUser[]> {
  const query = encodeURIComponent(q.trim());
  return adminFetch(`/users/search?q=${query}`);
}

export function listAdminUsers(q = '', limit = 50): Promise<PlatformAdminUserRow[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  params.set('limit', String(limit));
  return adminFetch(`/platform-admin/users?${params.toString()}`);
}

export function getAdminUser(userId: string): Promise<PlatformAdminUserDetail> {
  return adminFetch(`/platform-admin/users/${userId}`);
}

export function updateAdminUser(
  userId: string,
  data: {
    username?: string;
    displayName?: string;
    email?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bannerColor?: string | null;
  },
): Promise<PlatformAdminUserDetail> {
  return adminFetch(`/platform-admin/users/${userId}`, {
    method: 'PATCH',
    json: data,
  });
}

export function disableAdminUser(userId: string): Promise<PlatformAdminUserDetail> {
  return adminFetch(`/platform-admin/users/${userId}/disable`, {
    method: 'POST',
    json: {},
  });
}

export function enableAdminUser(userId: string): Promise<PlatformAdminUserDetail> {
  return adminFetch(`/platform-admin/users/${userId}/enable`, {
    method: 'POST',
    json: {},
  });
}

export function revokeAdminUserSessions(
  userId: string,
): Promise<{ ok: true; revoked: number }> {
  return adminFetch(`/platform-admin/users/${userId}/revoke-sessions`, {
    method: 'POST',
    json: {},
  });
}

export function kickAdminUserAllGuilds(
  userId: string,
): Promise<{ ok: true; kicked: number }> {
  return adminFetch(`/platform-admin/users/${userId}/kick-all`, {
    method: 'POST',
    json: {},
  });
}

export function timeoutAdminUser(
  userId: string,
  guildId: string,
  minutes: number,
): Promise<{ ok: true; timeoutUntil: string | null }> {
  return adminFetch(`/platform-admin/users/${userId}/timeout`, {
    method: 'POST',
    json: { guildId, minutes },
  });
}

export function banAdminUserFromGuild(
  userId: string,
  guildId: string,
  reason?: string,
): Promise<{ ok: true }> {
  return adminFetch(`/platform-admin/users/${userId}/ban-guild`, {
    method: 'POST',
    json: { guildId, reason },
  });
}

export function unbanAdminUserFromGuild(
  userId: string,
  guildId: string,
): Promise<{ ok: true }> {
  return adminFetch(`/platform-admin/users/${userId}/unban-guild`, {
    method: 'POST',
    json: { guildId },
  });
}

export function deleteAdminUser(userId: string): Promise<{ ok: true }> {
  return adminFetch(`/platform-admin/users/${userId}`, { method: 'DELETE' });
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
  limit = 40,
  before?: string | null,
): Promise<{ items: PlatformAdminMessageRow[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (before) params.set('before', before);
  return adminFetch(`/platform-admin/guilds/${guildId}/messages?${params.toString()}`);
}

export function reindexSearch(): Promise<Record<string, number>> {
  return adminFetch('/platform-admin/reindex', { method: 'POST', json: {} });
}

export function searchHealth(): Promise<{ ok: boolean; detail: string }> {
  return adminFetch('/platform-admin/search/health');
}

export function listGuildVoice(guildId: string): Promise<PlatformAdminVoiceRow[]> {
  return adminFetch(`/platform-admin/guilds/${guildId}/voice`);
}

export function listGuildRoles(guildId: string): Promise<RoleDto[]> {
  return adminFetch(`/platform-admin/guilds/${guildId}/roles`);
}

export function pinDiscoverGuild(guildId: string): Promise<GuildSummary> {
  return adminFetch(`/platform-admin/guilds/${guildId}/discover-pin`, {
    method: 'POST',
  });
}

export function unpinDiscoverGuild(guildId: string): Promise<GuildSummary> {
  return adminFetch(`/platform-admin/guilds/${guildId}/discover-pin`, {
    method: 'DELETE',
  });
}

export function platformSearch(opts: {
  q: string;
  types?: string[];
  guildId?: string;
  channelId?: string;
  limit?: number;
}): Promise<SearchResponse> {
  const params = new URLSearchParams();
  params.set('q', opts.q);
  if (opts.types?.length) params.set('types', opts.types.join(','));
  if (opts.guildId) params.set('guildId', opts.guildId);
  if (opts.channelId) params.set('channelId', opts.channelId);
  if (opts.limit) params.set('limit', String(opts.limit));
  return adminFetch(`/platform-admin/search?${params.toString()}`);
}

/** God-mode: normal guild API’leri (platform admin token ile) */
export function updateGuild(
  guildId: string,
  data: {
    name?: string;
    iconUrl?: string | null;
    bannerUrl?: string | null;
    discoverable?: boolean;
    afkChannelId?: string | null;
    afkTimeoutMinutes?: number;
  },
): Promise<GuildSummary> {
  return adminFetch(`/guilds/${guildId}`, { method: 'PATCH', json: data });
}

export function createChannel(
  guildId: string,
  data: {
    name: string;
    type: 'TEXT' | 'VOICE' | 'FORUM' | 'GAME' | 'WATCH_PARTY';
    gameKind?: 'billiards' | 'okey' | 'bowling' | 'tavla' | null;
    categoryId?: string | null;
    topic?: string | null;
  },
): Promise<ChannelSummary> {
  return adminFetch(`/guilds/${guildId}/channels`, { method: 'POST', json: data });
}

export function updateChannel(
  channelId: string,
  data: {
    name?: string;
    topic?: string | null;
    locked?: boolean;
    password?: string | null;
  },
): Promise<ChannelSummary> {
  return adminFetch(`/channels/${channelId}`, { method: 'PATCH', json: data });
}

export function deleteChannel(channelId: string): Promise<void> {
  return adminFetch(`/channels/${channelId}`, { method: 'DELETE' });
}

export function createGuildRole(
  guildId: string,
  body: {
    name: string;
    color?: string;
    permissions?: string[];
  },
): Promise<RoleDto> {
  return adminFetch(`/guilds/${guildId}/roles`, { method: 'POST', json: body });
}

export function updateGuildRole(
  guildId: string,
  roleId: string,
  body: Record<string, unknown>,
): Promise<RoleDto> {
  return adminFetch(`/guilds/${guildId}/roles/${roleId}`, {
    method: 'PATCH',
    json: body,
  });
}

export function deleteGuildRole(guildId: string, roleId: string): Promise<{ ok: true }> {
  return adminFetch(`/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' });
}

export function setMemberRoles(
  guildId: string,
  userId: string,
  roleIds: string[],
): Promise<{ ok: true; roleIds: string[] }> {
  return adminFetch(`/guilds/${guildId}/roles/members/${userId}`, {
    method: 'PUT',
    json: { roleIds },
  });
}

export function kickMember(guildId: string, userId: string): Promise<{ ok: true }> {
  return adminFetch(`/guilds/${guildId}/members/${userId}/kick`, {
    method: 'POST',
    json: {},
  });
}

export function banMember(guildId: string, userId: string): Promise<{ ok: true }> {
  return adminFetch(`/guilds/${guildId}/members/${userId}/ban`, {
    method: 'POST',
    json: {},
  });
}
