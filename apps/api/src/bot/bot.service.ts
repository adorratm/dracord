import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { User } from '@/database/entities/user.entity';
import { UserStatus } from '@/database/enums';
import {
  DRACORD_BOT_AVATAR_PATH,
  DRACORD_BOT_DISPLAY_NAME,
  DRACORD_BOT_EMAIL,
  DRACORD_BOT_USER_ID,
  DRACORD_BOT_USERNAME,
} from './bot.constants';

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
  ) {}

  /** Uygulama ikonu — FRONTEND_URL/logo.svg */
  botAvatarUrl(): string {
    const frontend = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    return `${frontend}${DRACORD_BOT_AVATAR_PATH}`;
  }

  async onModuleInit() {
    setTimeout(() => {
      void this.ensureBotEverywhere().catch((err: Error) => {
        this.logger.warn(`Bot bootstrap: ${err.message}`);
      });
    }, 1500);
  }

  async ensureBotUser(): Promise<User> {
    const avatarUrl = this.botAvatarUrl();
    let user = await this.em.findOne(User, { where: { id: DRACORD_BOT_USER_ID } });
    if (!user) {
      user = await this.em.findOne(User, { where: { email: DRACORD_BOT_EMAIL } });
    }
    if (user) {
      user.isBot = true;
      user.displayName = DRACORD_BOT_DISPLAY_NAME;
      user.username = DRACORD_BOT_USERNAME;
      user.status = UserStatus.ONLINE;
      user.usernameConfirmed = true;
      user.disabledAt = null;
      user.avatarUrl = avatarUrl;
      return this.em.save(User, user);
    }

    return this.em.save(
      User,
      this.em.create(User, {
        id: DRACORD_BOT_USER_ID,
        email: DRACORD_BOT_EMAIL,
        username: DRACORD_BOT_USERNAME,
        displayName: DRACORD_BOT_DISPLAY_NAME,
        passwordHash: null,
        avatarUrl,
        bannerColor: '#bd93f9',
        status: UserStatus.ONLINE,
        usernameConfirmed: true,
        isBot: true,
      }),
    );
  }

  async ensureBotInGuild(guildId: string): Promise<void> {
    const bot = await this.ensureBotUser();
    const existing = await this.em.findOne(GuildMember, {
      where: { guildId, userId: bot.id },
    });
    if (existing) return;
    await this.em.save(
      GuildMember,
      this.em.create(GuildMember, { guildId, userId: bot.id }),
    );
  }

  async ensureBotEverywhere(): Promise<void> {
    const bot = await this.ensureBotUser();
    const guilds = await this.em.find(Guild, { select: { id: true } });
    let added = 0;
    for (const g of guilds) {
      const existing = await this.em.findOne(GuildMember, {
        where: { guildId: g.id, userId: bot.id },
      });
      if (existing) continue;
      await this.em.save(
        GuildMember,
        this.em.create(GuildMember, { guildId: g.id, userId: bot.id }),
      );
      added += 1;
    }
    this.logger.log(
      `Dracord-Bot hazır (id=${bot.id}); ${guilds.length} sunucu, +${added} üyelik`,
    );
  }

  getBotUserId() {
    return DRACORD_BOT_USER_ID;
  }
}
