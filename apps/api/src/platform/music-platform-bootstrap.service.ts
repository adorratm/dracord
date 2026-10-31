import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { EntityManager } from 'typeorm';
import { BotService } from '@/bot/bot.service';
import { DRACORD_BOT_USER_ID } from '@/bot/bot.constants';
import { PlatformApplication } from '@/database/entities/platform-application.entity';
import { isPlatformApiEnabled } from './platform-enabled';

const MUSIC_APP_NAME = 'Dracord Music';

/**
 * First-party müzik botunu Platform Application’a bağlar.
 * Slash’ler hâlâ builtin (`BUILTIN_COMMANDS` + MusicCommandsService);
 * platform kaydı discovery / bot-sdk / admin yüzeyi içindir.
 */
@Injectable()
export class MusicPlatformBootstrapService implements OnModuleInit {
  private readonly log = new Logger(MusicPlatformBootstrapService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
    @Optional() private readonly bot?: BotService,
  ) {}

  onModuleInit() {
    if (!isPlatformApiEnabled(this.config)) return;
    setTimeout(() => {
      void this.ensure().catch((err: Error) => {
        this.log.warn(`Music platform bootstrap: ${err.message}`);
      });
    }, 2500);
  }

  async ensure() {
    if (!this.bot) return null;
    const botUser = await this.bot.ensureBotUser();
    let app = await this.em.findOne(PlatformApplication, {
      where: { botUserId: botUser.id, name: MUSIC_APP_NAME },
    });
    if (!app) {
      app = await this.em.findOne(PlatformApplication, {
        where: { botUserId: DRACORD_BOT_USER_ID },
      });
    }
    if (app) {
      let dirty = false;
      if (app.botUserId !== botUser.id) {
        app.botUserId = botUser.id;
        dirty = true;
      }
      if (app.name !== MUSIC_APP_NAME) {
        app.name = MUSIC_APP_NAME;
        dirty = true;
      }
      if (dirty) await this.em.save(PlatformApplication, app);
      this.log.debug(`Music platform app hazır id=${app.id}`);
      return { applicationId: app.id, botUserId: botUser.id, created: false };
    }

    const token = `dracord_music_${randomBytes(24).toString('hex')}`;
    const hash = createHash('sha256').update(token).digest('hex');
    app = this.em.create(PlatformApplication, {
      ownerUserId: botUser.id,
      name: MUSIC_APP_NAME,
      description:
        'First-party müzik botu — /oynat ve ilgili builtin komutlar (sistem)',
      redirectUris: [],
      scopes: ['bot', 'messages.write', 'guilds', 'applications.commands'],
      botUserId: botUser.id,
      botTokenHash: hash,
      botTokenLast4: token.slice(-4),
      webhookUrl: null,
      webhookSecret: null,
    });
    await this.em.save(PlatformApplication, app);
    this.log.log(`First-party music app oluşturuldu id=${app.id}`);
    return { applicationId: app.id, botUserId: botUser.id, created: true };
  }
}
