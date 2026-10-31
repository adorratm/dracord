import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { EntityManager, IsNull } from 'typeorm';
import { AuthService } from '@/auth/auth.service';
import { PlatformApplication } from '@/database/entities/platform-application.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import {
  SlashCommand,
  type SlashCommandOption,
  type SlashOptionType,
} from '@/database/entities/slash-command.entity';
import { User } from '@/database/entities/user.entity';
import { UserStatus } from '@/database/enums';
import { createId } from '@paralleldrive/cuid2';
import { QueuesService } from '@/queues/queues.service';
import { BotGatewayService } from './bot-gateway.service';
import { isPlatformApiEnabled, isPlatformOauthEnabled } from './platform-enabled';
import { BUILTIN_COMMANDS } from '@/bot/bots.controller';

export type ApplicationDto = {
  id: string;
  name: string;
  description: string;
  redirectUris: string[];
  scopes: string[];
  botUserId: string | null;
  botTokenLast4: string | null;
  webhookUrl: string | null;
  createdAt: string;
  /** Yalnızca oluşturma / reset anında */
  botToken?: string;
};

/** Kullanıcı OAuth scope’ları (bot scope’larından ayrı) */
export const OAUTH_USER_SCOPES = [
  'identify',
  'email',
  'guilds',
  'connections',
] as const;

/** OAuth authorization code (bellek; MVP) */
const oauthCodes = new Map<
  string,
  {
    applicationId: string;
    userId: string;
    redirectUri: string;
    scopes: string[];
    expiresAt: number;
  }
>();

/** OAuth refresh token (bellek; MVP) */
const oauthRefreshTokens = new Map<
  string,
  {
    applicationId: string;
    userId: string;
    scopes: string[];
    expiresAt: number;
  }
>();

const OAUTH_REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;

@Injectable()
export class PlatformService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    @Optional() private readonly queues?: QueuesService,
    @Optional() private readonly botGateway?: BotGatewayService,
  ) {}

  assertEnabled() {
    if (!isPlatformApiEnabled(this.config)) {
      throw new ServiceUnavailableException(
        'Platform API kapalı (PLATFORM_API=true ile aç)',
      );
    }
  }

  private toDto(app: PlatformApplication, botToken?: string): ApplicationDto {
    return {
      id: app.id,
      name: app.name,
      description: app.description ?? '',
      redirectUris: app.redirectUris ?? [],
      scopes: app.scopes ?? [],
      botUserId: app.botUserId,
      botTokenLast4: app.botTokenLast4,
      webhookUrl: app.webhookUrl,
      createdAt: app.createdAt.toISOString(),
      ...(botToken ? { botToken } : {}),
    };
  }

  async listMine(ownerUserId: string): Promise<ApplicationDto[]> {
    this.assertEnabled();
    const rows = await this.em.find(PlatformApplication, {
      where: { ownerUserId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    ownerUserId: string,
    data: {
      name: string;
      description?: string;
      redirectUris?: string[];
      withBot?: boolean;
    },
  ): Promise<ApplicationDto> {
    this.assertEnabled();
    const name = data.name?.trim();
    if (!name || name.length < 2 || name.length > 64) {
      throw new BadRequestException('Geçersiz uygulama adı');
    }
    const app = this.em.create(PlatformApplication, {
      ownerUserId,
      name,
      description: (data.description ?? '').slice(0, 500),
      redirectUris: (data.redirectUris ?? []).filter(
        (u) => typeof u === 'string' && u.startsWith('http'),
      ),
      scopes: [
        'bot',
        'identify',
        'email',
        'guilds',
        'connections',
        'messages.write',
        'applications.commands',
      ],
      botUserId: null,
      botTokenHash: null,
      botTokenLast4: null,
      webhookUrl: null,
      webhookSecret: null,
    });
    let botToken: string | undefined;
    if (data.withBot !== false) {
      const created = await this.attachBot(app, name);
      botToken = created.token;
    }
    await this.em.save(app);
    return this.toDto(app, botToken);
  }

  private async attachBot(
    app: PlatformApplication,
    name: string,
  ): Promise<{ token: string }> {
    const botId = createId();
    const uname = `bot_${botId.slice(0, 10)}`.toLowerCase();
    const bot = this.em.create(User, {
      id: botId,
      email: `${uname}@bot.dracord.local`,
      username: uname,
      displayName: `${name} Bot`.slice(0, 64),
      passwordHash: null,
      avatarUrl: null,
      isBot: true,
      usernameConfirmed: true,
      status: UserStatus.ONLINE,
    });
    await this.em.save(bot);
    const token = `dracord.${randomBytes(24).toString('hex')}`;
    app.botUserId = botId;
    app.botTokenHash = createHash('sha256').update(token).digest('hex');
    app.botTokenLast4 = token.slice(-4);
    return { token };
  }

  async resetBotToken(
    ownerUserId: string,
    applicationId: string,
  ): Promise<ApplicationDto> {
    this.assertEnabled();
    const app = await this.em.findOne(PlatformApplication, {
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('Uygulama yok');
    if (app.ownerUserId !== ownerUserId) throw new ForbiddenException();
    if (!app.botUserId) {
      const created = await this.attachBot(app, app.name);
      await this.em.save(app);
      return this.toDto(app, created.token);
    }
    const token = `dracord.${randomBytes(24).toString('hex')}`;
    app.botTokenHash = createHash('sha256').update(token).digest('hex');
    app.botTokenLast4 = token.slice(-4);
    await this.em.save(app);
    return this.toDto(app, token);
  }

  async setWebhook(
    ownerUserId: string,
    applicationId: string,
    webhookUrl: string | null,
  ): Promise<ApplicationDto> {
    this.assertEnabled();
    const app = await this.em.findOne(PlatformApplication, {
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('Uygulama yok');
    if (app.ownerUserId !== ownerUserId) throw new ForbiddenException();
    if (webhookUrl) {
      try {
        const u = new URL(webhookUrl);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') {
          throw new Error('bad');
        }
      } catch {
        throw new BadRequestException('Geçersiz webhook URL');
      }
      app.webhookUrl = webhookUrl;
      app.webhookSecret =
        app.webhookSecret ?? randomBytes(16).toString('hex');
    } else {
      app.webhookUrl = null;
    }
    await this.em.save(app);
    return this.toDto(app);
  }

  async deleteApp(ownerUserId: string, applicationId: string) {
    this.assertEnabled();
    const app = await this.em.findOne(PlatformApplication, {
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('Uygulama yok');
    if (app.ownerUserId !== ownerUserId) throw new ForbiddenException();
    await this.em.remove(app);
    return { ok: true };
  }

  normalizeOauthScopes(
    requested: string[] | undefined,
    appScopes: string[],
  ): string[] {
    const allowed = new Set([
      ...OAUTH_USER_SCOPES,
      ...appScopes.filter((s) => typeof s === 'string'),
    ]);
    const raw = (requested?.length ? requested : ['identify']).map((s) =>
      s.trim().toLowerCase(),
    );
    const out = [...new Set(raw.filter((s) => s && allowed.has(s)))];
    if (!out.includes('identify')) out.unshift('identify');
    return out;
  }

  /** OAuth2 — kod üret (kullanıcı onayladı) */
  createAuthCode(opts: {
    applicationId: string;
    userId: string;
    redirectUri: string;
    scopes: string[];
  }): string {
    if (!isPlatformOauthEnabled(this.config)) {
      throw new ServiceUnavailableException('PLATFORM_OAUTH kapalı');
    }
    const code = randomBytes(20).toString('hex');
    oauthCodes.set(code, {
      applicationId: opts.applicationId,
      userId: opts.userId,
      redirectUri: opts.redirectUri,
      scopes: opts.scopes,
      expiresAt: Date.now() + 10 * 60_000,
    });
    return code;
  }

  private issueRefreshToken(opts: {
    applicationId: string;
    userId: string;
    scopes: string[];
  }): string {
    const token = randomBytes(32).toString('hex');
    oauthRefreshTokens.set(token, {
      applicationId: opts.applicationId,
      userId: opts.userId,
      scopes: opts.scopes,
      expiresAt: Date.now() + OAUTH_REFRESH_TTL_MS,
    });
    return token;
  }

  async exchangeCode(opts: {
    code: string;
    clientId: string;
    redirectUri: string;
  }): Promise<{
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token: string;
    scope: string;
  }> {
    if (!isPlatformOauthEnabled(this.config)) {
      throw new ServiceUnavailableException('PLATFORM_OAUTH kapalı');
    }
    const entry = oauthCodes.get(opts.code);
    oauthCodes.delete(opts.code);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new BadRequestException('Geçersiz veya süresi dolmuş kod');
    }
    if (
      entry.applicationId !== opts.clientId ||
      entry.redirectUri !== opts.redirectUri
    ) {
      throw new BadRequestException('client_id / redirect_uri uyuşmuyor');
    }
    const app = await this.em.findOne(PlatformApplication, {
      where: { id: opts.clientId },
    });
    if (!app) throw new NotFoundException('Uygulama yok');
    const issued = await this.auth.issueOauthAccessToken(entry.userId, {
      scopes: entry.scopes,
      applicationId: opts.clientId,
    });
    const refresh_token = this.issueRefreshToken({
      applicationId: opts.clientId,
      userId: entry.userId,
      scopes: entry.scopes,
    });
    return { ...issued, refresh_token };
  }

  async refreshOauthToken(opts: {
    refreshToken: string;
    clientId: string;
  }): Promise<{
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token: string;
    scope: string;
  }> {
    if (!isPlatformOauthEnabled(this.config)) {
      throw new ServiceUnavailableException('PLATFORM_OAUTH kapalı');
    }
    const entry = oauthRefreshTokens.get(opts.refreshToken);
    oauthRefreshTokens.delete(opts.refreshToken);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new BadRequestException('Geçersiz veya süresi dolmuş refresh_token');
    }
    if (entry.applicationId !== opts.clientId) {
      throw new BadRequestException('client_id uyuşmuyor');
    }
    const issued = await this.auth.issueOauthAccessToken(entry.userId, {
      scopes: entry.scopes,
      applicationId: opts.clientId,
    });
    const refresh_token = this.issueRefreshToken({
      applicationId: opts.clientId,
      userId: entry.userId,
      scopes: entry.scopes,
    });
    return { ...issued, refresh_token };
  }

  /** Consent UI için public uygulama özeti */
  async getOauthAppPublic(clientId: string) {
    if (!isPlatformOauthEnabled(this.config)) {
      throw new ServiceUnavailableException('PLATFORM_OAUTH kapalı');
    }
    const app = await this.findApp(clientId);
    if (!app) throw new NotFoundException('Uygulama yok');
    const userScopes = (app.scopes ?? []).filter((s) =>
      (OAUTH_USER_SCOPES as readonly string[]).includes(s),
    );
    const available =
      userScopes.length > 0
        ? userScopes
        : (['identify', 'email', 'guilds'] as string[]);
    return {
      id: app.id,
      name: app.name,
      description: app.description,
      scopes: available,
    };
  }

  async getGuildForBot(botUserId: string, guildId: string) {
    this.assertEnabled();
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId: botUserId },
    });
    if (!member) throw new ForbiddenException('Bot bu sunucunun üyesi değil');
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Sunucu yok');
    return {
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconUrl,
      ownerId: guild.ownerId,
    };
  }

  async syncSlashCommands(
    applicationId: string,
    botUserId: string,
    ownerUserId: string,
    body: {
      /** `global` | `@global` | boş → guild’siz global komutlar */
      guildId?: string | null;
      commands?: Array<{
        name: string;
        description: string;
        usage?: string;
        aliases?: string[];
        responseTemplate?: string;
        options?: SlashCommandOption[];
      }>;
    },
  ) {
    this.assertEnabled();
    const rawGuild = (body.guildId ?? '').trim();
    const isGlobal =
      !rawGuild ||
      rawGuild.toLowerCase() === 'global' ||
      rawGuild === '@global';
    const guildId: string | null = isGlobal ? null : rawGuild;

    if (!isGlobal) {
      const member = await this.em.findOne(GuildMember, {
        where: { guildId: guildId!, userId: ownerUserId },
      });
      const botMember = await this.em.findOne(GuildMember, {
        where: { guildId: guildId!, userId: botUserId },
      });
      if (!member && !botMember) {
        throw new ForbiddenException(
          'Uygulama sahibi veya bot sunucuda olmalı',
        );
      }
    }

    const app = await this.em.findOne(PlatformApplication, {
      where: { id: applicationId },
    });
    if (!app?.botUserId || app.botUserId !== botUserId) {
      throw new ForbiddenException();
    }

    const existing = await this.em.find(SlashCommand, {
      where: isGlobal
        ? { guildId: IsNull(), botUserId }
        : { guildId: guildId!, botUserId },
    });
    if (existing.length) await this.em.remove(SlashCommand, existing);

    const botUser = await this.em.findOne(User, { where: { id: botUserId } });
    const botName = botUser?.displayName ?? app.name;
    const out: Array<{
      id: string;
      name: string;
      description: string;
      usage: string;
    }> = [];

    for (const raw of body.commands ?? []) {
      const name = (raw.name ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 32);
      if (name.length < 2) continue;
      if (
        BUILTIN_COMMANDS.some(
          (c) =>
            c.name === name ||
            (c.aliases as readonly string[]).includes(name),
        )
      ) {
        continue;
      }
      const description = (raw.description ?? name).trim().slice(0, 200) || name;
      const usage = (raw.usage ?? `/${name}`).trim().slice(0, 120);
      const aliases = (raw.aliases ?? [])
        .map((a) => a.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32))
        .filter(Boolean);
      const options = this.normalizeSlashOptions(raw.options);
      const row = this.em.create(SlashCommand, {
        guildId,
        name,
        description,
        usage,
        aliases: aliases.length ? aliases : null,
        options: options.length ? options : null,
        responseTemplate: raw.responseTemplate?.trim().slice(0, 2000) || null,
        botUserId,
        botName: botName.slice(0, 64),
        createdById: ownerUserId,
      });
      await this.em.save(SlashCommand, row);
      out.push({ id: row.id, name: row.name, description, usage });
    }
    return { applicationId, guildId, commands: out };
  }

  private normalizeSlashOptions(
    raw: SlashCommandOption[] | undefined,
  ): SlashCommandOption[] {
    if (!Array.isArray(raw)) return [];
    const allowed = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const out: SlashCommandOption[] = [];
    for (const o of raw.slice(0, 25)) {
      const name = String(o?.name ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 32);
      if (name.length < 1) continue;
      const type = Number(o?.type) as SlashOptionType;
      if (!allowed.has(type)) continue;
      const description =
        String(o?.description ?? name).trim().slice(0, 100) || name;
      const choices = Array.isArray(o?.choices)
        ? o.choices
            .slice(0, 25)
            .map((c) => ({
              name: String(c?.name ?? '').slice(0, 100),
              value:
                typeof c?.value === 'number'
                  ? c.value
                  : String(c?.value ?? '').slice(0, 100),
            }))
            .filter((c) => c.name)
        : undefined;
      out.push({
        type,
        name,
        description,
        required: Boolean(o?.required),
        ...(choices?.length ? { choices } : {}),
      });
    }
    return out;
  }

  async findApp(id: string) {
    return this.em.findOne(PlatformApplication, { where: { id } });
  }

  /** Webhook outbound — kuyruğa al (retry) + canlı bot gateway */
  async dispatchWebhook(
    applicationId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    this.botGateway?.dispatchToApplication(applicationId, event, {
      ...payload,
      at: new Date().toISOString(),
    });
    if (this.queues) {
      await this.queues.enqueueWebhook(applicationId, event, payload);
      return;
    }
    await this.deliverWebhook(applicationId, event, payload);
  }

  /** Worker: gerçek HTTP POST */
  async deliverWebhook(
    applicationId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const app = await this.findApp(applicationId);
    if (!app?.webhookUrl) return;
    const body = JSON.stringify({
      event,
      applicationId,
      at: new Date().toISOString(),
      data: payload,
    });
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Dracord-Event': event,
    };
    if (app.webhookSecret) {
      headers['X-Dracord-Signature'] = createHash('sha256')
        .update(app.webhookSecret + body)
        .digest('hex');
    }
    const res = await fetch(app.webhookUrl, { method: 'POST', headers, body });
    if (!res.ok) {
      throw new Error(`Webhook HTTP ${res.status}`);
    }
  }
}
