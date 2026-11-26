import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { GuildBackupService } from './guild-backup.service';

@Controller('guilds')
@UseGuards(JwtAuthGuard)
export class GuildBackupController {
  constructor(private readonly backup: GuildBackupService) {}

  /** MANAGE_GUILD — sunucu yedeği (JSON) */
  @Get(':guildId/backup')
  export(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.backup.export(guildId, user.sub);
  }

  /** Sahip — yedeği bu sunucuya ekle (silmez, aynı adı atlar) */
  @Post(':guildId/backup/restore')
  restore(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser, @Body() body: { backup?: unknown }) {
    return this.backup.restore(guildId, user.sub, body?.backup);
  }

  /** Yedekten / şablondan yeni sunucu */
  @Post('from-backup')
  createFrom(@CurrentUser() user: JwtPayloadUser, @Body() body: { backup?: unknown; name?: string }) {
    return this.backup.createFrom(user.sub, body?.backup, body?.name);
  }
}
