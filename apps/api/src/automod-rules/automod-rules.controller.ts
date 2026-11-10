import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import type { GuildAutomodConfigDto } from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { GuildsService } from '@/guilds/guilds.service';
import { AutomodRulesService } from './automod-rules.service';

@Controller('guilds/:guildId/automod')
@UseGuards(JwtAuthGuard)
export class AutomodRulesController {
  constructor(
    private readonly automod: AutomodRulesService,
    private readonly guilds: GuildsService,
  ) {}

  @Get()
  async get(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    await this.guilds.requirePermission(guildId, user.sub, GuildPermissions.MANAGE_GUILD);
    return this.automod.getConfig(guildId);
  }

  @Patch()
  update(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: Partial<Omit<GuildAutomodConfigDto, 'guildId'>>,
  ) {
    return this.automod.updateConfig(guildId, user.sub, body ?? {});
  }

  @Get('events')
  events(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser, @Query('limit') limit?: string) {
    return this.automod.listEvents(guildId, user.sub, Number(limit) || 100);
  }
}
