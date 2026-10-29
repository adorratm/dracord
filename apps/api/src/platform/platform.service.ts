import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { EntityManager } from 'typeorm';
import { PlatformApplication } from '@/database/entities/platform-application.entity';
import { User } from '@/database/entities/user.entity';
import { UserStatus } from '@/database/enums';
import { createId } from '@paralleldrive/cuid2';
import { isPlatformApiEnabled, isPlatformOauthEnabled } from './platform-enabled';

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

/** OAuth authorization code (bellek; MVP) */
const oauthCodes = new Map<
  string,
  { applicationId: string; userId: string; redirectUri: string; expiresAt: number }
>();

@Injectable()
export class PlatformService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
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
      scopes: ['bot', 'identify', 'messages.write'],
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

  /** OAuth2 — kod üret (kullanıcı onayladı) */
  createAuthCode(opts: {
    applicationId: string;
    userId: string;
    redirectUri: string;
  }): string {
    if (!isPlatformOauthEnabled(this.config)) {
      throw new ServiceUnavailableException('PLATFORM_OAUTH kapalı');
    }
    const code = randomBytes(20).toString('hex');
    oauthCodes.set(code, {
      applicationId: opts.applicationId,
      userId: opts.userId,
      redirectUri: opts.redirectUri,
      expiresAt: Date.now() + 10 * 60_000,
    });
    return code;
  }

  async exchangeCode(opts: {
    code: string;
    clientId: string;
    redirectUri: string;
  }): Promise<{ access_token: string; token_type: 'Bearer'; expires_in: number }> {
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
    // MVP: kısa ömürlü opaque token (gerçek JWT OAuth sonraki iterasyon)
    const access = `oauth.${entry.userId}.${randomBytes(16).toString('hex')}`;
    return { access_token: access, token_type: 'Bearer', expires_in: 3600 };
  }

  async findApp(id: string) {
    return this.em.findOne(PlatformApplication, { where: { id } });
  }

  /** Webhook outbound (best-effort, flag açıkken) */
  async dispatchWebhook(
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
    void fetch(app.webhookUrl, { method: 'POST', headers, body }).catch(
      () => undefined,
    );
  }
}
