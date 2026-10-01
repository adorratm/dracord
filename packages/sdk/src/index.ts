import { io, Socket } from 'socket.io-client';
import type {
  AuthTokens,
  CategoryDto,
  ChannelSummary,
  ClientSettings,
  GuildInviteDto,
  GuildSummary,
  MessageAttachment,
  MessageBookmarkDto,
  MessageDto,
  MessagePage,
  PresignUploadResponse,
  PublicUser,
  SearchResponse,
  SocialLinks,
  VoiceStatePayload,
  VoiceTokenResponse,
  GifDto,
  TenorGifDto,
} from '@dracord/types';
import { SocketEvents } from '@dracord/types';

function resolveDefaultBaseUrl(): string {
  const fromEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.NEXT_PUBLIC_API_URL;
  return fromEnv || 'http://localhost:4000';
}

function formatApiError(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') {
      if (parsed.message === 'Unauthorized' || status === 401) {
        return 'Oturum süresi dolmuş veya geçersiz. Tekrar giriş yap.';
      }
      return parsed.message;
    }
  } catch {
    // ignore
  }
  if (status === 401) return 'Oturum süresi dolmuş veya geçersiz. Tekrar giriş yap.';
  return text || `HTTP ${status}`;
}

export class DracordClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshInFlight: Promise<string | null> | null = null;
  private onTokensUpdated:
    | ((tokens: AuthTokens) => void)
    | null = null;
  private getRefreshToken: (() => string | null) | null = null;
  public socket: Socket | null = null;

  constructor(baseUrl = resolveDefaultBaseUrl()) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setToken(token: string | null) {
    this.accessToken = token;
  }

  configureAuth(options: {
    getRefreshToken: () => string | null;
    onTokensUpdated?: (tokens: AuthTokens) => void;
  }) {
    this.getRefreshToken = options.getRefreshToken;
    this.onTokensUpdated = options.onTokensUpdated ?? null;
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = (async () => {
      const refreshToken = this.getRefreshToken?.();
      if (!refreshToken) return null;
      try {
        const tokens = await this.refresh(refreshToken);
        this.setToken(tokens.accessToken);
        this.onTokensUpdated?.(tokens);
        if (this.socket) {
          this.socket.auth = { token: tokens.accessToken };
          // Eski JWT ile bağlı soketi yenile — aksi halde presence kopar
          this.socket.disconnect();
          this.socket.connect();
        }
        return tokens.accessToken;
      } catch {
        return null;
      } finally {
        this.refreshInFlight = null;
      }
    })();
    return this.refreshInFlight;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    retried = false,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (!(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });

    if (res.status === 401 && !retried && path !== '/auth/refresh') {
      const next = await this.refreshAccessToken();
      if (next) {
        return this.request<T>(path, init, true);
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(formatApiError(res.status, text));
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async getMe(): Promise<PublicUser> {
    return this.request('/auth/me');
  }

  async updatePresence(data: {
    status: PublicUser['status'];
    customStatus?: string | null;
  }): Promise<PublicUser> {
    return this.request('/presence/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async checkUsernameAvailable(username: string): Promise<{ username: string; available: boolean }> {
    return this.request(
      `/users/username/available?username=${encodeURIComponent(username)}`,
    );
  }

  async confirmUsername(username: string): Promise<PublicUser> {
    return this.request('/users/me/username', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  async updateProfile(data: {
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bannerColor?: string | null;
    accentColor?: string | null;
    socialLinks?: SocialLinks | null;
    censorLinkPreviews?: boolean;
  }): Promise<PublicUser> {
    return this.request('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
  }

  async getClientSettings(): Promise<ClientSettings> {
    return this.request('/users/me/settings');
  }

  async updateClientSettings(
    patch: Partial<ClientSettings>,
  ): Promise<ClientSettings> {
    return this.request('/users/me/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
    return this.request('/users/me/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async deactivateAccount(password?: string): Promise<{ ok: true }> {
    return this.request('/users/me/deactivate', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async loginDev(
    username?: string,
  ): Promise<
    | (AuthTokens & { user: PublicUser })
    | { requires2fa: true; challengeToken: string }
  > {
    const name = username || 'VampireDev';
    const slug = name.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'vampiredev';
    return this.request('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({
        username: slug,
        displayName: name,
        email: `${slug}@dracord.local`,
      }),
    });
  }

  async verifyTwoFactor(
    challengeToken: string,
    code: string,
  ): Promise<AuthTokens & { user: PublicUser }> {
    return this.request('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, code }),
    });
  }

  async getTwoFactorStatus(): Promise<{ enabled: boolean; recoveryRemaining: number }> {
    return this.request('/auth/2fa/status');
  }

  async beginTwoFactorSetup(): Promise<{ secret: string; otpauthUrl: string }> {
    return this.request('/auth/2fa/setup', { method: 'POST', body: '{}' });
  }

  async confirmTwoFactorSetup(
    code: string,
  ): Promise<{ enabled: true; recoveryCodes: string[] }> {
    return this.request('/auth/2fa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async regenerateTwoFactorRecovery(
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    return this.request('/auth/2fa/recovery/regenerate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disableTwoFactor(opts: {
    code?: string;
    password?: string;
  }): Promise<{ enabled: false }> {
    return this.request('/auth/2fa', {
      method: 'DELETE',
      body: JSON.stringify(opts),
    });
  }

  async cancelTwoFactorSetup(): Promise<{ ok: true }> {
    return this.request('/auth/2fa/setup', { method: 'DELETE' });
  }

  getGoogleLoginUrl(intent: 'web' | 'admin' | 'desktop' = 'web') {
    const url = new URL(`${this.baseUrl}/auth/google`);
    if (intent === 'admin' || intent === 'desktop') {
      url.searchParams.set('intent', intent);
    }
    return url.toString();
  }

  async getAdminMe(): Promise<PublicUser> {
    return this.request('/auth/admin/me');
  }

  async listBotCommands(guildId?: string): Promise<{
    commands: Array<{
      id?: string;
      name: string;
      aliases?: string[];
      description: string;
      usage: string;
      botId?: string;
      botName?: string;
      custom?: boolean;
    }>;
  }> {
    const q = guildId ? `?guildId=${encodeURIComponent(guildId)}` : '';
    return this.request(`/bots/commands${q}`);
  }

  async listGuildSlashCommands(guildId: string): Promise<
    Array<{
      id: string;
      name: string;
      aliases: string[];
      description: string;
      usage: string;
      botUserId: string | null;
      botName: string | null;
      createdById: string;
      createdAt: string;
    }>
  > {
    return this.request(`/guilds/${guildId}/slash-commands`);
  }

  async registerGuildSlashCommand(
    guildId: string,
    body: {
      name: string;
      description: string;
      usage?: string;
      aliases?: string[];
      botName?: string;
      responseTemplate?: string;
    },
  ): Promise<{
    id: string;
    name: string;
    aliases: string[];
    description: string;
    usage: string;
    responseTemplate?: string | null;
    botUserId: string | null;
    botName: string | null;
    createdById: string;
    createdAt: string;
  }> {
    return this.request(`/guilds/${guildId}/slash-commands`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async deleteGuildSlashCommand(guildId: string, commandId: string): Promise<void> {
    await this.request(`/guilds/${guildId}/slash-commands/${commandId}`, {
      method: 'DELETE',
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const res = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(formatApiError(res.status, text));
    }
    return res.json() as Promise<AuthTokens>;
  }

  async listGuilds(): Promise<GuildSummary[]> {
    return this.request('/guilds');
  }

  async discoverGuilds(query?: string): Promise<GuildSummary[]> {
    const q = query?.trim();
    if (q) {
      return this.request(`/guilds/discover?q=${encodeURIComponent(q)}`);
    }
    return this.request('/guilds/discover');
  }

  async createGuild(data: {
    name: string;
    iconUrl?: string | null;
    discoverable?: boolean;
  }): Promise<GuildSummary> {
    return this.request('/guilds', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateGuild(
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
    return this.request(`/guilds/${guildId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteGuild(guildId: string): Promise<void> {
    await this.request(`/guilds/${guildId}`, { method: 'DELETE' });
  }

  async createInvite(
    guildId: string,
    opts?: { maxUses?: number | null; expiresInHours?: number | null },
  ): Promise<GuildInviteDto> {
    return this.request(`/guilds/${guildId}/invites`, {
      method: 'POST',
      body: JSON.stringify(opts ?? {}),
    });
  }

  async joinInvite(code: string): Promise<GuildSummary> {
    return this.request(`/invites/${code}/join`, { method: 'POST', body: '{}' });
  }

  async joinDiscoverableGuild(guildId: string): Promise<GuildSummary> {
    return this.request(`/guilds/${guildId}/join`, { method: 'POST', body: '{}' });
  }

  async getGuildChannels(guildId: string): Promise<ChannelSummary[]> {
    return this.request(`/guilds/${guildId}/channels`);
  }

  async getGuildMembers(guildId: string): Promise<PublicUser[]> {
    return this.request(`/guilds/${guildId}/members`);
  }

  async createChannel(
    guildId: string,
    data: {
      name: string;
      type: 'TEXT' | 'VOICE' | 'FORUM';
      categoryId?: string | null;
      topic?: string | null;
    },
  ): Promise<ChannelSummary> {
    return this.request(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChannel(
    channelId: string,
    data: {
      name?: string;
      topic?: string | null;
      categoryId?: string | null;
      position?: number;
      locked?: boolean;
      password?: string | null;
      deniedUserIds?: string[];
      permissionOverwrites?: Array<{
        id: string;
        type: 'role' | 'member';
        allow: string[];
        deny: string[];
      }> | null;
    },
  ): Promise<ChannelSummary> {
    return this.request(`/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async reorderGuildChannels(
    guildId: string,
    items: Array<{ id: string; position: number; categoryId?: string | null }>,
  ): Promise<ChannelSummary[]> {
    return this.request(`/guilds/${guildId}/channels/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    });
  }

  async listGuildCategories(guildId: string): Promise<CategoryDto[]> {
    return this.request(`/guilds/${guildId}/categories`);
  }

  async createGuildCategory(guildId: string, name: string): Promise<CategoryDto> {
    return this.request(`/guilds/${guildId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateGuildCategory(
    guildId: string,
    categoryId: string,
    data: { name?: string; position?: number },
  ): Promise<CategoryDto> {
    return this.request(`/guilds/${guildId}/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteGuildCategory(guildId: string, categoryId: string): Promise<void> {
    await this.request(`/guilds/${guildId}/categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  async deleteChannel(channelId: string): Promise<void> {
    return this.request(`/channels/${channelId}`, { method: 'DELETE' });
  }

  async getMessages(
    channelId: string,
    opts: number | { limit?: number; before?: string; around?: string } = 50,
  ): Promise<MessagePage> {
    const q =
      typeof opts === 'number'
        ? { limit: opts }
        : { limit: opts.limit ?? 50, before: opts.before, around: opts.around };
    const params = new URLSearchParams();
    params.set('limit', String(q.limit ?? 50));
    if (q.before) params.set('before', q.before);
    if (q.around) params.set('around', q.around);
    const raw = await this.request<MessagePage | MessageDto[]>(
      `/channels/${channelId}/messages?${params.toString()}`,
    );
    if (Array.isArray(raw)) {
      return { items: raw, hasMore: raw.length >= (q.limit ?? 50) };
    }
    return raw;
  }

  async search(opts: {
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
    return this.request(`/search?${params.toString()}`);
  }

  async openDm(userId: string): Promise<ChannelSummary> {
    return this.request(`/dm/${userId}`, { method: 'POST' });
  }

  async listDms(): Promise<ChannelSummary[]> {
    return this.request('/dm');
  }

  async listDmMembers(channelId: string): Promise<PublicUser[]> {
    return this.request(`/dm/channels/${channelId}/members`);
  }

  async addDmMember(channelId: string, userId: string): Promise<PublicUser[]> {
    return this.request(`/dm/channels/${channelId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async removeDmMember(channelId: string, userId: string): Promise<PublicUser[]> {
    return this.request(`/dm/channels/${channelId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  async getDmCall(channelId: string): Promise<{
    active: boolean;
    mode: 'audio' | 'video';
    startedBy: string | null;
    participants: Array<{
      id: string;
      displayName: string;
      avatarUrl?: string | null;
      muted?: boolean;
      deafened?: boolean;
    }>;
  }> {
    return this.request(`/dm/channels/${channelId}/calls`);
  }

  async startDmCall(
    channelId: string,
    mode: 'audio' | 'video' = 'audio',
  ): Promise<{ ok: true; mode: 'audio' | 'video' }> {
    return this.request(`/dm/channels/${channelId}/calls`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  }

  async inviteToDmCall(channelId: string, userId: string): Promise<{ ok: true }> {
    return this.request(`/dm/channels/${channelId}/calls/invite`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async removeFromDmCall(channelId: string, userId: string): Promise<{ ok: true }> {
    return this.request(`/dm/channels/${channelId}/calls/remove`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async declineDmCall(channelId: string): Promise<{ ok: true }> {
    return this.request(`/dm/channels/${channelId}/calls/decline`, {
      method: 'POST',
      body: '{}',
    });
  }

  async sendMessage(
    channelId: string,
    content: string,
    attachments?: MessageAttachment[],
    poll?: { question: string; options: string[]; multi?: boolean },
    opts?: {
      replyToId?: string;
      threadRootId?: string;
      type?: 'default' | 'heading';
    },
  ): Promise<MessageDto> {
    return this.request(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        attachments,
        poll,
        replyToId: opts?.replyToId,
        threadRootId: opts?.threadRootId,
        type: opts?.type,
      }),
    });
  }

  async getMessageThread(messageId: string, limit = 100): Promise<MessagePage> {
    return this.request(`/messages/${messageId}/thread?limit=${limit}`);
  }

  async updateMessage(messageId: string, content: string): Promise<MessageDto> {
    return this.request(`/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  }

  async deleteMessage(messageId: string): Promise<{ id: string; channelId: string }> {
    return this.request(`/messages/${messageId}`, { method: 'DELETE' });
  }

  async toggleReaction(messageId: string, emoji: string): Promise<MessageDto> {
    return this.request(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  async votePoll(messageId: string, optionId: string): Promise<MessageDto> {
    return this.request(`/messages/${messageId}/poll/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    });
  }

  async pinMessage(messageId: string): Promise<MessageDto> {
    return this.request(`/messages/${messageId}/pin`, { method: 'POST' });
  }

  async unpinMessage(messageId: string): Promise<MessageDto> {
    return this.request(`/messages/${messageId}/pin`, { method: 'DELETE' });
  }

  async bookmarkMessage(messageId: string): Promise<MessageDto> {
    return this.request(`/messages/${messageId}/bookmark`, { method: 'POST' });
  }

  async unbookmarkMessage(messageId: string): Promise<MessageDto> {
    return this.request(`/messages/${messageId}/bookmark`, { method: 'DELETE' });
  }

  async listBookmarks(limit = 50): Promise<MessageBookmarkDto[]> {
    return this.request(`/users/me/bookmarks?limit=${limit}`);
  }

  async listPinnedMessages(channelId: string): Promise<MessageDto[]> {
    return this.request(`/channels/${channelId}/pins`);
  }

  async forwardMessage(
    messageId: string,
    targetChannelId: string,
    content?: string,
  ): Promise<MessageDto> {
    return this.request(`/messages/${messageId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ targetChannelId, content }),
    });
  }

  async markChannelRead(
    channelId: string,
    opts?: { messageId?: string; unreadFrom?: boolean },
  ): Promise<{ lastReadMessageId: string | null }> {
    return this.request(`/channels/${channelId}/read`, {
      method: 'POST',
      body: JSON.stringify(opts ?? {}),
    });
  }

  async getChannelReadState(
    channelId: string,
  ): Promise<{ lastReadMessageId: string | null; unread: boolean }> {
    return this.request(`/channels/${channelId}/read-state`);
  }

  async hideMessage(messageId: string, permanent = false): Promise<{ ok: true }> {
    return this.request(`/messages/${messageId}/hide`, {
      method: 'POST',
      body: JSON.stringify({ permanent }),
    });
  }

  async unhideMessage(messageId: string): Promise<{ ok: true }> {
    return this.request(`/messages/${messageId}/hide`, { method: 'DELETE' });
  }

  async getGuildPermissions(guildId: string): Promise<import('@dracord/types').GuildPermissionsDto> {
    return this.request(`/guilds/${guildId}/permissions`);
  }

  async kickGuildMember(guildId: string, userId: string): Promise<{ ok: true }> {
    return this.request(`/guilds/${guildId}/members/${userId}/kick`, {
      method: 'POST',
      body: '{}',
    });
  }

  async banGuildMember(
    guildId: string,
    userId: string,
    reason?: string,
  ): Promise<{ ok: true }> {
    return this.request(`/guilds/${guildId}/members/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async unbanGuildMember(guildId: string, userId: string): Promise<{ ok: true }> {
    return this.request(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' });
  }

  async listGuildBans(
    guildId: string,
  ): Promise<
    Array<{ userId: string; reason: string | null; bannedById: string; createdAt: string }>
  > {
    return this.request(`/guilds/${guildId}/bans`);
  }

  async timeoutGuildMember(
    guildId: string,
    userId: string,
    minutes: number,
  ): Promise<{ ok: true; timeoutUntil: string | null }> {
    return this.request(`/guilds/${guildId}/members/${userId}/timeout`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    });
  }

  async listGuildAuditLogs(guildId: string): Promise<
    Array<{
      id: string;
      actorId: string;
      action: string;
      targetId: string | null;
      targetType: string | null;
      meta: Record<string, unknown> | null;
      createdAt: string;
    }>
  > {
    return this.request(`/guilds/${guildId}/audit-logs`);
  }

  async blockUser(userId: string): Promise<{ ok: true }> {
    return this.request(`/users/${userId}/block`, { method: 'POST', body: '{}' });
  }

  async unblockUser(userId: string): Promise<{ ok: true }> {
    return this.request(`/users/${userId}/block`, { method: 'DELETE' });
  }

  async listBlocked(): Promise<PublicUser[]> {
    return this.request('/users/blocked');
  }

  async getPendingFriends(): Promise<import('@dracord/types').FriendPendingLists> {
    return this.request('/users/friends/pending');
  }

  async sendFriendRequest(userId: string): Promise<{ ok: true; status: string }> {
    return this.request(`/users/${userId}/friend-request`, {
      method: 'POST',
      body: '{}',
    });
  }

  async acceptFriendRequest(userId: string): Promise<{ ok: true }> {
    return this.request(`/users/${userId}/friend-request/accept`, {
      method: 'POST',
      body: '{}',
    });
  }

  async declineFriendRequest(userId: string): Promise<{ ok: true }> {
    return this.request(`/users/${userId}/friend-request`, { method: 'DELETE' });
  }

  async listGuildRoles(guildId: string): Promise<import('@dracord/types').RoleDto[]> {
    return this.request(`/guilds/${guildId}/roles`);
  }

  async createGuildRole(
    guildId: string,
    body: {
      name: string;
      color?: string;
      permissions?: string[];
      badgeKey?: string | null;
      profileBgKey?: string | null;
      hoist?: boolean;
    },
  ): Promise<import('@dracord/types').RoleDto> {
    return this.request(`/guilds/${guildId}/roles`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateGuildRole(
    guildId: string,
    roleId: string,
    body: Record<string, unknown>,
  ): Promise<import('@dracord/types').RoleDto> {
    return this.request(`/guilds/${guildId}/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteGuildRole(guildId: string, roleId: string): Promise<{ ok: true }> {
    return this.request(`/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' });
  }

  async addMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
  ): Promise<{ ok: true }> {
    return this.request(`/guilds/${guildId}/roles/members/${userId}/${roleId}`, {
      method: 'POST',
      body: '{}',
    });
  }

  async removeMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
  ): Promise<{ ok: true }> {
    return this.request(`/guilds/${guildId}/roles/members/${userId}/${roleId}`, {
      method: 'DELETE',
    });
  }

  async setMemberRoles(
    guildId: string,
    userId: string,
    roleIds: string[],
  ): Promise<{ ok: true; roleIds: string[] }> {
    return this.request(`/guilds/${guildId}/roles/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ roleIds }),
    });
  }

  async getVoiceToken(
    channelId: string,
    password?: string,
  ): Promise<VoiceTokenResponse> {
    return this.request('/voice/token', {
      method: 'POST',
      body: JSON.stringify({ channelId, password }),
    });
  }

  async joinVoiceState(
    channelId: string,
    flags?: { muted?: boolean; deafened?: boolean; password?: string },
  ): Promise<VoiceStatePayload> {
    return this.request('/voice/state', {
      method: 'POST',
      body: JSON.stringify({ channelId, ...flags }),
    });
  }

  async updateVoiceState(
    channelId: string,
    flags: { muted?: boolean; deafened?: boolean },
  ): Promise<VoiceStatePayload | null> {
    return this.request('/voice/state', {
      method: 'PATCH',
      body: JSON.stringify({ channelId, ...flags }),
    });
  }

  async leaveVoiceState(channelId: string): Promise<VoiceStatePayload | null> {
    return this.request(`/voice/state/${channelId}`, { method: 'DELETE' });
  }

  async denyVoiceUser(channelId: string, userId: string): Promise<ChannelSummary> {
    return this.request(`/voice/channels/${channelId}/deny`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async allowVoiceUser(channelId: string, userId: string): Promise<ChannelSummary> {
    return this.request(`/voice/channels/${channelId}/allow`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async disconnectVoiceUser(channelId: string, userId: string): Promise<{ ok: boolean }> {
    return this.request(`/voice/channels/${channelId}/disconnect`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async moveVoiceUser(
    userId: string,
    targetChannelId: string,
  ): Promise<{ ok: true; targetChannelId: string }> {
    return this.request('/voice/move', {
      method: 'POST',
      body: JSON.stringify({ userId, targetChannelId }),
    });
  }

  async voiceHeartbeat(channelId: string): Promise<{ ok: boolean }> {
    return this.request('/voice/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ channelId }),
    });
  }

  async getMusicState(
    guildId: string,
    voiceChannelId: string,
  ): Promise<import('@dracord/types').MusicQueueState | { empty: true }> {
    const q = new URLSearchParams({ guildId, voiceChannelId });
    return this.request(`/music/state?${q.toString()}`);
  }

  async controlMusic(body: {
    guildId: string;
    voiceChannelId: string;
    textChannelId?: string;
    action: 'pause' | 'resume' | 'skip' | 'stop' | 'volume';
    volume?: number;
  }): Promise<{
    ok: boolean;
    state?: import('@dracord/types').MusicQueueState | null;
    reason?: string;
  }> {
    return this.request('/music/control', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async presignUpload(input: {
    filename: string;
    contentType: string;
    folder?: string;
  }): Promise<PresignUploadResponse> {
    return this.request('/uploads/presign', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async uploadFile(file: File, folder = 'attachments'): Promise<MessageAttachment> {
    const presign = await this.presignUpload({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      folder,
    });
    const put = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!put.ok) {
      throw new Error(`Yükleme başarısız (${put.status})`);
    }
    return {
      id: presign.key,
      url: presign.publicUrl,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    };
  }

  async searchGifs(query: string): Promise<GifDto[]> {
    const q = encodeURIComponent(query.trim());
    return this.request(`/media/gifs/search?q=${q}`);
  }

  async featuredGifs(): Promise<GifDto[]> {
    return this.request('/media/gifs/featured');
  }

  async gifProviderStatus(): Promise<{ configured: boolean; provider?: string }> {
    return this.request('/media/gifs/status');
  }

  /** @deprecated Use searchGifs */
  async searchTenorGifs(query: string): Promise<TenorGifDto[]> {
    return this.searchGifs(query);
  }

  /** @deprecated Use featuredGifs */
  async featuredTenorGifs(): Promise<TenorGifDto[]> {
    return this.featuredGifs();
  }

  /** @deprecated Use gifProviderStatus */
  async tenorStatus(): Promise<{ configured: boolean }> {
    return this.gifProviderStatus();
  }

  async getFriends(): Promise<PublicUser[]> {
    return this.request('/users/friends');
  }

  async searchUsers(query: string): Promise<PublicUser[]> {
    const q = encodeURIComponent(query.trim());
    return this.request(`/users/search?q=${q}`);
  }

  async listNotifications(opts?: {
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<import('@dracord/types').NotificationDto[]> {
    const params = new URLSearchParams();
    if (opts?.unreadOnly) params.set('unreadOnly', '1');
    if (opts?.limit) params.set('limit', String(opts.limit));
    const q = params.toString();
    return this.request(`/notifications${q ? `?${q}` : ''}`);
  }

  async notificationsUnreadCount(): Promise<{ count: number }> {
    return this.request('/notifications/unread-count');
  }

  async markNotificationRead(id: string): Promise<import('@dracord/types').NotificationDto> {
    return this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    return this.request('/notifications/read-all', { method: 'POST', body: '{}' });
  }

  async getPushVapidPublicKey(): Promise<{ publicKey: string | null; enabled: boolean }> {
    return this.request('/notifications/push/vapid-public-key');
  }

  async subscribePush(data: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  }): Promise<{ ok: true }> {
    return this.request('/notifications/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async unsubscribePush(endpoint: string): Promise<{ ok: true }> {
    return this.request('/notifications/push/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
  }

  connectSocket() {
    if (this.socket) {
      this.socket.auth = { token: this.accessToken };
      if (!this.socket.connected) this.socket.connect();
      return this.socket;
    }
    this.socket = io(this.baseUrl, {
      auth: { token: this.accessToken },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
    });
    return this.socket;
  }

  joinChannel(channelId: string) {
    this.socket?.emit(SocketEvents.CHANNEL_JOIN, { channelId });
  }

  leaveChannel(channelId: string) {
    this.socket?.emit(SocketEvents.CHANNEL_LEAVE, { channelId });
  }

  emitVoiceState(payload: {
    guildId: string;
    channelId: string | null;
    muted?: boolean;
    deafened?: boolean;
  }) {
    this.socket?.emit(SocketEvents.VOICE_STATE, payload);
  }

  startTyping(channelId: string) {
    this.socket?.emit(SocketEvents.TYPING_START, { channelId });
  }
}

export { SocketEvents };
export * from '@dracord/types';
