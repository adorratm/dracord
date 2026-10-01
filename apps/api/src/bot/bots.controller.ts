import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { SlashCommand } from '@/database/entities/slash-command.entity';

/** Kayıtlı slash komutları (müzik botu + sunucu özel). */
export const BUILTIN_COMMANDS = [
  {
    name: 'oynat',
    aliases: ['play'],
    description: 'Şarkı veya URL çal',
    usage: '/oynat <şarkı veya url>',
    botId: 'system-dracord-bot',
    botName: 'Dracord Bot',
  },
  {
    name: 'atla',
    aliases: ['skip'],
    description: 'Sonraki şarkıya geç',
    usage: '/atla',
    botId: 'system-dracord-bot',
    botName: 'Dracord Bot',
  },
  {
    name: 'duraklat',
    aliases: ['pause'],
    description: 'Çalmayı duraklat',
    usage: '/duraklat',
    botId: 'system-dracord-bot',
    botName: 'Dracord Bot',
  },
  {
    name: 'devam',
    aliases: ['resume'],
    description: 'Çalmaya devam et',
    usage: '/devam',
    botId: 'system-dracord-bot',
    botName: 'Dracord Bot',
  },
  {
    name: 'durdur',
    aliases: ['stop'],
    description: 'Müziği durdur ve kuyruğu temizle',
    usage: '/durdur',
    botId: 'system-dracord-bot',
    botName: 'Dracord Bot',
  },
  {
    name: 'kuyruk',
    aliases: ['queue'],
    description: 'Kuyruğu göster',
    usage: '/kuyruk',
    botId: 'system-dracord-bot',
    botName: 'Dracord Bot',
  },
  {
    name: 'ses',
    aliases: ['volume'],
    description: 'Bot sunucu ses seviyesini ayarla (0–100)',
    usage: '/ses <0-100>',
    botId: 'system-dracord-bot',
    botName: 'Dracord Bot',
  },
  {
    name: 'kaldir',
    aliases: ['remove'],
    description: 'Kuyruktan parça kaldır',
    usage: '/kaldir <sıra>',
    botId: 'system-dracord-bot',
    botName: 'Dracord Bot',
  },
] as const;

@Controller('bots')
@UseGuards(JwtAuthGuard)
export class BotsController {
  constructor(private readonly em: EntityManager) {}

  @Get('commands')
  async listCommands(
    @CurrentUser() user: { sub: string },
    @Query('guildId') guildId?: string,
  ) {
    const custom: Array<{
      id?: string;
      name: string;
      aliases?: string[];
      description: string;
      usage: string;
      botId?: string;
      botName?: string;
      custom?: boolean;
    }> = [];

    if (guildId) {
      const member = await this.em.findOne(GuildMember, {
        where: { guildId, userId: user.sub },
      });
      if (!member) {
        throw new ForbiddenException('Bu sunucunun üyesi değilsin');
      }
      const rows = await this.em.find(SlashCommand, {
        where: { guildId },
        order: { name: 'ASC' },
      });
      for (const row of rows) {
        custom.push({
          id: row.id,
          name: row.name,
          aliases: row.aliases ?? undefined,
          description: row.description,
          usage: row.usage,
          botId: row.botUserId ?? undefined,
          botName: row.botName ?? 'Özel',
          custom: true,
        });
      }
    }

    return {
      commands: [
        ...BUILTIN_COMMANDS.map((c) => ({ ...c, custom: false as const })),
        ...custom,
      ],
    };
  }
}
