import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '@/platform-admin/platform-admin.guard';
import { PlatformAdminService } from '@/platform-admin/platform-admin.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('platform-admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly admin: PlatformAdminService) {}

  @Get('guilds')
  listGuilds() {
    return this.admin.listGuilds();
  }

  @Get('guilds/:guildId')
  getGuild(@Param('guildId') guildId: string) {
    return this.admin.getGuild(guildId);
  }

  @Get('guilds/:guildId/channels')
  listChannels(@Param('guildId') guildId: string) {
    return this.admin.listChannels(guildId);
  }

  @Get('guilds/:guildId/members')
  listMembers(@Param('guildId') guildId: string) {
    return this.admin.listMembers(guildId);
  }

  @Get('guilds/:guildId/messages')
  listMessages(
    @Param('guildId') guildId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 50;
    return this.admin.listRecentMessages(guildId, Number.isFinite(n) ? n : 50);
  }

  @Get('guilds/:guildId/voice')
  listVoice(@Param('guildId') guildId: string) {
    return this.admin.listVoice(guildId);
  }
}
