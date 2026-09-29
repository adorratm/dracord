import { io, Socket } from 'socket.io-client';
import type {
  AuthTokens,
  ChannelSummary,
  GuildInviteDto,
  GuildSummary,
  MessageAttachment,
  MessageDto,
  PresignUploadResponse,
  PublicUser,
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
          if (!this.socket.connected) this.socket.connect();
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

  async updateProfile(data: {
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bannerColor?: string | null;
    accentColor?: string | null;
    socialLinks?: SocialLinks | null;
  }): Promise<PublicUser> {
    return this.request('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
  }

  async loginDev(username?: string): Promise<AuthTokens & { user: PublicUser }> {
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

  getGoogleLoginUrl() {
    return `${this.baseUrl}/auth/google`;
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

  async discoverGuilds(): Promise<GuildSummary[]> {
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

  async createChannel(
    guildId: string,
    data: {
      name: string;
      type: 'TEXT' | 'VOICE';
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
    data: { name?: string; topic?: string | null; categoryId?: string | null },
  ): Promise<ChannelSummary> {
    return this.request(`/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteChannel(channelId: string): Promise<void> {
    return this.request(`/channels/${channelId}`, { method: 'DELETE' });
  }

  async getMessages(channelId: string, limit = 50): Promise<MessageDto[]> {
    return this.request(`/channels/${channelId}/messages?limit=${limit}`);
  }

  async sendMessage(
    channelId: string,
    content: string,
    attachments?: MessageAttachment[],
  ): Promise<MessageDto> {
    return this.request(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, attachments }),
    });
  }

  async getVoiceToken(channelId: string): Promise<VoiceTokenResponse> {
    return this.request('/voice/token', {
      method: 'POST',
      body: JSON.stringify({ channelId }),
    });
  }

  async joinVoiceState(
    channelId: string,
    flags?: { muted?: boolean; deafened?: boolean },
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

  async voiceHeartbeat(channelId: string): Promise<{ ok: boolean }> {
    return this.request('/voice/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ channelId }),
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

  connectSocket() {
    if (this.socket?.connected) return this.socket;
    this.socket = io(this.baseUrl, {
      auth: { token: this.accessToken },
      transports: ['websocket', 'polling'],
      withCredentials: true,
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
