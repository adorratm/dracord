import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import type { UserActivity } from '@dracord/types';
import { OauthConnection } from '@/database/entities/oauth-connection.entity';
import { UserActivityService } from '@/presence/user-activity.service';

const SPOTIFY_AUTH = 'https://accounts.spotify.com';
const SPOTIFY_API = 'https://api.spotify.com/v1';
const SCOPES = ['user-read-currently-playing', 'user-read-playback-state'].join(' ');

@Injectable()
export class SpotifyService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SpotifyService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly em: EntityManager,
    private readonly userActivity: UserActivityService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('SPOTIFY_CLIENT_ID')?.trim() &&
        this.config.get<string>('SPOTIFY_CLIENT_SECRET')?.trim(),
    );
  }

  getRedirectUri(): string {
    return (
      this.config.get<string>('SPOTIFY_REDIRECT_URI')?.trim() ||
      `${this.config.get<string>('API_PUBLIC_URL')?.replace(/\/$/, '') || 'http://localhost:4000'}/oauth/spotify/callback`
    );
  }

  getAuthorizeUrl(state: string): string | null {
    if (!this.isConfigured()) return null;
    const clientId = this.config.get<string>('SPOTIFY_CLIENT_ID')!.trim();
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: this.getRedirectUri(),
      scope: SCOPES,
      state,
      show_dialog: 'false',
    });
    return `${SPOTIFY_AUTH}/authorize?${params}`;
  }

  async exchangeCode(code: string, userId: string): Promise<{ ok: true }> {
    if (!this.isConfigured()) throw new Error('Spotify yapılandırılmamış');
    const token = await this.tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.getRedirectUri(),
    });
    await this.upsertConnection(userId, token);
    return { ok: true };
  }

  async disconnect(userId: string): Promise<{ ok: true }> {
    const row = await this.em.findOne(OauthConnection, {
      where: { userId, provider: 'spotify' },
    });
    if (row) await this.em.remove(OauthConnection, row);
    await this.userActivity.clearActivity(userId, 'spotify');
    return { ok: true };
  }

  async connectionStatus(userId: string): Promise<{
    configured: boolean;
    connected: boolean;
    authorizeUrl: string | null;
  }> {
    const configured = this.isConfigured();
    const row = configured
      ? await this.em.findOne(OauthConnection, {
          where: { userId, provider: 'spotify' },
        })
      : null;
    return {
      configured,
      connected: Boolean(row),
      authorizeUrl: configured ? this.getAuthorizeUrl(`u:${userId}`) : null,
    };
  }

  onModuleInit() {
    if (!this.isConfigured()) {
      this.log.warn('SPOTIFY_CLIENT_ID/SECRET yok — Spotify presence kapalı');
      return;
    }
    this.timer = setInterval(() => void this.pollAll(), 25_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async pollAll() {
    if (this.running || !this.isConfigured()) return;
    this.running = true;
    try {
      const rows = await this.em.find(OauthConnection, {
        where: { provider: 'spotify' },
        take: 100,
      });
      for (const row of rows) {
        try {
          await this.pollUser(row);
        } catch (e) {
          this.log.debug(
            `Spotify poll ${row.userId}: ${e instanceof Error ? e.message : e}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async pollUser(row: OauthConnection) {
    const access = await this.ensureAccessToken(row);
    if (!access) return;
    const res = await fetch(`${SPOTIFY_API}/me/player/currently-playing`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (res.status === 204 || res.status === 202) {
      await this.userActivity.clearActivity(row.userId, 'spotify');
      return;
    }
    if (res.status === 401) {
      const refreshed = await this.refresh(row);
      if (!refreshed) {
        await this.em.remove(OauthConnection, row);
        await this.userActivity.clearActivity(row.userId, 'spotify');
      }
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as {
      is_playing?: boolean;
      item?: {
        name?: string;
        artists?: Array<{ name: string }>;
        album?: { name?: string; images?: Array<{ url: string }> };
        external_urls?: { spotify?: string };
      };
    };
    if (!data.is_playing || !data.item?.name) {
      await this.userActivity.clearActivity(row.userId, 'spotify');
      return;
    }
    const artists = (data.item.artists ?? []).map((a) => a.name).join(', ');
    const activity: UserActivity = {
      type: 'listening',
      name: artists ? `${artists} — ${data.item.name}` : data.item.name,
      details: data.item.album?.name ?? 'Spotify',
      source: 'spotify',
      imageUrl: data.item.album?.images?.[0]?.url ?? null,
      url: data.item.external_urls?.spotify ?? null,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    await this.userActivity.setActivity(row.userId, activity);
  }

  private async ensureAccessToken(row: OauthConnection): Promise<string | null> {
    if (row.expiresAt && row.expiresAt.getTime() > Date.now() + 30_000) {
      return row.accessToken;
    }
    return this.refresh(row);
  }

  private async refresh(row: OauthConnection): Promise<string | null> {
    if (!row.refreshToken) return null;
    try {
      const token = await this.tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: row.refreshToken,
      });
      await this.upsertConnection(row.userId, token, row);
      return token.access_token;
    } catch {
      return null;
    }
  }

  private async upsertConnection(
    userId: string,
    token: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    },
    existing?: OauthConnection,
  ) {
    const row =
      existing ??
      (await this.em.findOne(OauthConnection, {
        where: { userId, provider: 'spotify' },
      })) ??
      this.em.create(OauthConnection, {
        userId,
        provider: 'spotify',
        accessToken: '',
        refreshToken: null,
        expiresAt: null,
        scopes: SCOPES.split(' '),
      });
    row.accessToken = token.access_token;
    if (token.refresh_token) row.refreshToken = token.refresh_token;
    row.expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : null;
    row.scopes = SCOPES.split(' ');
    await this.em.save(OauthConnection, row);
  }

  private async tokenRequest(body: Record<string, string>) {
    const clientId = this.config.get<string>('SPOTIFY_CLIENT_ID')!.trim();
    const clientSecret = this.config.get<string>('SPOTIFY_CLIENT_SECRET')!.trim();
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(`${SPOTIFY_AUTH}/api/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify token: ${res.status} ${text}`);
    }
    return (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
  }
}
