import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { DRACORD_BOT_USER_ID, type StreamAlertDto, type StreamAlertsListDto, type StreamPlatform } from '@dracord/types';
import { BotService } from '@/bot/bot.service';
import { Channel } from '@/database/entities/channel.entity';
import { Guild } from '@/database/entities/guild.entity';
import { ChannelType } from '@/database/enums';
import { StreamAlert } from '@/database/entities/stream-alert.entity';
import { GuildsService } from '@/guilds/guilds.service';
import { MessagesService } from '@/messages/messages.service';
import { channelIdFromHtml, parseHandle, parseYoutubeFeed, renderAlert } from './feeds';

const MAX_PER_GUILD = 10;
const POLL_MS = 60_000;
/** her abonelik en fazla bu sıklıkla kontrol edilir */
const RECHECK_SQL = `interval '3 minutes'`;
const BATCH = 60;
const FETCH_TIMEOUT = 8000;
const MAX_BODY = 6_000_000;
const UA = 'Mozilla/5.0 (compatible; DracordBot/1.0; +https://dracord.com.tr)';

async function getText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT), headers: { 'user-agent': UA, ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BODY) throw new Error('yanıt çok büyük');
  return text;
}

/** D7 — Twitch / YouTube yayın bildirimleri: bot, seçilen kanala mesaj atar */
@Injectable()
export class StreamAlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(StreamAlertsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private twitchToken: { value: string; exp: number } | null = null;

  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly messages: MessagesService,
    private readonly bot: BotService,
  ) {}

  get twitchEnabled(): boolean {
    return !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
  }

  onModuleInit(): void {
    if (process.env.STREAM_ALERTS_DISABLED === '1') return;
    this.timer = setInterval(() => void this.pollOnce(), POLL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private dto(r: StreamAlert): StreamAlertDto {
    return {
      id: r.id,
      guildId: r.guildId,
      channelId: r.channelId,
      platform: r.platform as StreamPlatform,
      handle: r.handle,
      displayName: r.displayName,
      message: r.message,
      isLive: r.isLive,
      lastNotifiedAt: r.lastNotifiedAt?.toISOString() ?? null,
      lastError: r.lastError,
    };
  }

  private async assertManage(guildId: string, userId: string): Promise<void> {
    await this.guilds.ensureMember(guildId, userId);
    const owner = (await this.em.count(Guild, { where: { id: guildId, ownerId: userId } })) > 0;
    const ok = owner || (await this.guilds.memberHasPermission(guildId, userId, 'MANAGE_GUILD'));
    if (!ok) throw new ForbiddenException('Yayın bildirimlerini yalnız sunucuyu yönetenler düzenleyebilir');
  }

  async list(guildId: string, userId: string): Promise<StreamAlertsListDto> {
    await this.assertManage(guildId, userId);
    const rows = await this.em.find(StreamAlert, { where: { guildId }, order: { createdAt: 'ASC' } });
    return { alerts: rows.map((r) => this.dto(r)), twitchEnabled: this.twitchEnabled, max: MAX_PER_GUILD };
  }

  async create(
    guildId: string,
    userId: string,
    raw: { platform?: unknown; handle?: unknown; channelId?: unknown; message?: unknown },
  ): Promise<StreamAlertDto> {
    await this.assertManage(guildId, userId);
    const platform = raw?.platform === 'twitch' || raw?.platform === 'youtube' ? raw.platform : null;
    if (!platform) throw new BadRequestException('Platform twitch ya da youtube olmalı');
    if (platform === 'twitch' && !this.twitchEnabled) {
      throw new BadRequestException('Twitch bildirimleri bu sunucuda henüz açılmadı (yönetici TWITCH_CLIENT_ID/SECRET eklemeli)');
    }
    const parsed = parseHandle(platform, typeof raw.handle === 'string' ? raw.handle : '');
    if (!parsed) throw new BadRequestException(platform === 'twitch' ? 'Geçerli bir Twitch kullanıcı adı ya da bağlantısı gir' : 'Geçerli bir YouTube kanal bağlantısı (@kullanıcı ya da /channel/UC…) gir');
    const channelId = typeof raw.channelId === 'string' ? raw.channelId : '';
    const ch = await this.em.findOne(Channel, { where: { id: channelId, guildId } });
    if (!ch || ch.type !== ChannelType.TEXT) throw new BadRequestException('Bildirim kanalı bu sunucudaki bir metin kanalı olmalı');
    if ((await this.em.count(StreamAlert, { where: { guildId } })) >= MAX_PER_GUILD) {
      throw new BadRequestException(`Bir sunucuda en fazla ${MAX_PER_GUILD} yayın bildirimi olabilir`);
    }
    const message = typeof raw.message === 'string' && raw.message.trim() ? raw.message.trim().slice(0, 300) : null;

    let handle: string;
    let displayName: string;
    if (parsed.platform === 'twitch') {
      handle = parsed.handle;
      displayName = await this.twitchDisplayName(handle).catch(() => handle);
    } else {
      handle = 'channelId' in parsed ? parsed.channelId : await this.resolveYoutubeAt(parsed.at);
      const feed = parseYoutubeFeed(await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${handle}`).catch(() => {
        throw new BadRequestException('YouTube kanalına ulaşılamadı — bağlantıyı kontrol et');
      }));
      displayName = (feed.channelTitle ?? handle).slice(0, 100);
    }
    if (await this.em.count(StreamAlert, { where: { guildId, platform, handle, channelId } })) {
      throw new BadRequestException('Bu yayıncı bu kanal için zaten ekli');
    }
    const row = await this.em.save(
      StreamAlert,
      this.em.create(StreamAlert, { guildId, channelId, platform, handle, displayName, message, createdBy: userId, checkedAt: new Date(0) }),
    );
    // ilk kontrol hemen: YouTube için taban çizgisi (eski videolar bildirilmez)
    void this.checkRows([row]).catch(() => undefined);
    return this.dto(row);
  }

  async update(guildId: string, userId: string, id: string, raw: { channelId?: unknown; message?: unknown }): Promise<StreamAlertDto> {
    await this.assertManage(guildId, userId);
    const row = await this.em.findOne(StreamAlert, { where: { id, guildId } });
    if (!row) throw new NotFoundException('Bildirim bulunamadı');
    const patch: Partial<StreamAlert> = {};
    if (raw.channelId !== undefined) {
      const ch = await this.em.findOne(Channel, { where: { id: String(raw.channelId), guildId } });
      if (!ch || ch.type !== ChannelType.TEXT) throw new BadRequestException('Bildirim kanalı bu sunucudaki bir metin kanalı olmalı');
      patch.channelId = ch.id;
    }
    if (raw.message !== undefined) patch.message = typeof raw.message === 'string' && raw.message.trim() ? raw.message.trim().slice(0, 300) : null;
    await this.em.update(StreamAlert, { id }, patch);
    return this.dto(await this.em.findOneOrFail(StreamAlert, { where: { id } }));
  }

  async remove(guildId: string, userId: string, id: string): Promise<{ ok: true }> {
    await this.assertManage(guildId, userId);
    await this.em.delete(StreamAlert, { id, guildId });
    return { ok: true };
  }

  /** bildirim önizlemesi: kanala örnek mesaj atar */
  async test(guildId: string, userId: string, id: string): Promise<{ ok: true }> {
    await this.assertManage(guildId, userId);
    const row = await this.em.findOne(StreamAlert, { where: { id, guildId } });
    if (!row) throw new NotFoundException('Bildirim bulunamadı');
    const url = row.platform === 'twitch' ? `https://www.twitch.tv/${row.handle}` : `https://www.youtube.com/channel/${row.handle}`;
    await this.post(row, `🧪 Deneme · ${renderAlert(row.message, { name: row.displayName, title: 'Örnek yayın başlığı', url, platform: row.platform as StreamPlatform, live: true })}`);
    return { ok: true };
  }

  // ── yoklama ──────────────────────────────────────────────────────

  async pollOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // atomik sahiplenme: birden fazla API kopyası aynı satırı iki kez işlemez
      const claimed = (await this.em.query(
        `UPDATE stream_alerts SET "checkedAt" = now()
          WHERE id IN (
            SELECT id FROM stream_alerts
             WHERE "checkedAt" < now() - ${RECHECK_SQL}
             ORDER BY "checkedAt" ASC LIMIT ${BATCH}
             FOR UPDATE SKIP LOCKED)
        RETURNING id`,
      )) as unknown;
      const ids = (Array.isArray(claimed) && Array.isArray(claimed[0]) ? claimed[0] : claimed) as Array<{ id: string }>;
      if (!ids?.length) return;
      const rows = await this.em.find(StreamAlert, { where: { id: In(ids.map((r) => r.id)) } });
      await this.checkRows(rows);
    } catch (e) {
      this.log.warn(`stream poll: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
  }

  private async checkRows(rows: StreamAlert[]): Promise<void> {
    const tw = rows.filter((r) => r.platform === 'twitch');
    const yt = rows.filter((r) => r.platform === 'youtube');
    if (tw.length && this.twitchEnabled) await this.checkTwitch(tw).catch((e) => this.markError(tw, e));
    for (const r of yt) await this.checkYoutube(r).catch((e) => this.markError([r], e));
  }

  private async markError(rows: StreamAlert[], e: unknown): Promise<void> {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    for (const r of rows) await this.em.update(StreamAlert, { id: r.id }, { lastError: msg }).catch(() => undefined);
  }

  private async post(row: StreamAlert, content: string): Promise<void> {
    await this.bot.ensureBotInGuild(row.guildId);
    await this.messages.createMessage(row.channelId, DRACORD_BOT_USER_ID, content);
  }

  private async checkYoutube(row: StreamAlert): Promise<void> {
    const feed = parseYoutubeFeed(await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${row.handle}`));
    const latest = feed.items[0];
    if (!latest) return void (await this.em.update(StreamAlert, { id: row.id }, { lastError: null }));
    if (!row.lastItemId) {
      // ilk kontrol: taban çizgisi, bildirim yok
      await this.em.update(StreamAlert, { id: row.id }, { lastItemId: latest.id, lastError: null });
      return;
    }
    if (latest.id === row.lastItemId) return void (row.lastError && (await this.em.update(StreamAlert, { id: row.id }, { lastError: null })));
    // önce kimliği yaz (çift bildirimi önler), sonra gönder
    const fresh = Date.now() - latest.published < 12 * 3600_000;
    await this.em.update(StreamAlert, { id: row.id }, { lastItemId: latest.id, lastError: null, ...(fresh ? { lastNotifiedAt: new Date() } : {}) });
    if (!fresh) return;
    const live = /\b(canlı|live|yayın)\b/i.test(latest.title);
    await this.post(row, renderAlert(row.message, { name: row.displayName, title: latest.title, url: latest.url, platform: 'youtube', live }));
  }

  private async twitchAuth(): Promise<string> {
    if (this.twitchToken && this.twitchToken.exp > Date.now() + 60_000) return this.twitchToken.value;
    const body = new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    });
    const j = JSON.parse(await getText('https://id.twitch.tv/oauth2/token', { method: 'POST', body })) as { access_token?: string; expires_in?: number };
    if (!j.access_token) throw new Error('Twitch kimlik doğrulaması başarısız');
    this.twitchToken = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
  }

  private async helix<T>(path: string): Promise<T> {
    const token = await this.twitchAuth();
    return JSON.parse(await getText(`https://api.twitch.tv/helix/${path}`, { headers: { 'client-id': process.env.TWITCH_CLIENT_ID!, authorization: `Bearer ${token}` } })) as T;
  }

  private async twitchDisplayName(login: string): Promise<string> {
    const j = await this.helix<{ data?: Array<{ display_name: string }> }>(`users?login=${encodeURIComponent(login)}`);
    const name = j.data?.[0]?.display_name;
    if (!name) throw new BadRequestException('Twitch kullanıcısı bulunamadı');
    return name.slice(0, 100);
  }

  private async checkTwitch(rows: StreamAlert[]): Promise<void> {
    const logins = [...new Set(rows.map((r) => r.handle))].slice(0, 100);
    const q = logins.map((l) => `user_login=${encodeURIComponent(l)}`).join('&');
    const j = await this.helix<{ data?: Array<{ id: string; user_login: string; user_name: string; title: string; started_at: string }> }>(`streams?${q}`);
    const live = new Map((j.data ?? []).map((s) => [s.user_login.toLowerCase(), s]));
    for (const r of rows) {
      const s = live.get(r.handle);
      if (!s) {
        if (r.isLive || r.lastError) await this.em.update(StreamAlert, { id: r.id }, { isLive: false, lastError: null });
        continue;
      }
      if (s.id === r.lastItemId) continue;
      // yeni yayın: ilk eklemede yalnız son 15 dk içinde başladıysa bildir
      const recent = Date.now() - Date.parse(s.started_at) < 15 * 60_000;
      const notify = !!r.lastItemId || recent;
      await this.em.update(StreamAlert, { id: r.id }, { isLive: true, lastItemId: s.id, lastError: null, ...(notify ? { lastNotifiedAt: new Date() } : {}) });
      if (notify) {
        await this.post(r, renderAlert(r.message, { name: s.user_name || r.displayName, title: s.title, url: `https://www.twitch.tv/${r.handle}`, platform: 'twitch', live: true }));
      }
    }
  }

  private async resolveYoutubeAt(at: string): Promise<string> {
    const html = await getText(`https://www.youtube.com/${encodeURIComponent(at).replace('%40', '@')}`).catch(() => {
      throw new BadRequestException('YouTube kanalına ulaşılamadı — bağlantıyı kontrol et');
    });
    const id = channelIdFromHtml(html);
    if (!id) throw new BadRequestException('YouTube kanal kimliği bulunamadı — /channel/UC… bağlantısını dene');
    return id;
  }
}
