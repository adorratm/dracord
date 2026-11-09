import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { GuildStatsService } from './guild-stats.service';

@Controller('guilds/:guildId/stats')
@UseGuards(JwtAuthGuard)
export class GuildStatsController {
  constructor(private readonly stats: GuildStatsService) {}

  /** MANAGE_GUILD — ?days=7|30|90 */
  @Get()
  get(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser, @Query('days') days?: string) {
    return this.stats.getStats(guildId, user.sub, Number(days) || 30);
  }
}
