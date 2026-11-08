import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { GuildLevelConfigDto } from '@dracord/types';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { LevelsService } from './levels.service';

@Controller('guilds/:guildId/levels')
@UseGuards(JwtAuthGuard)
export class LevelsController {
  constructor(private readonly levels: LevelsService) {}

  @Get('leaderboard')
  leaderboard(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.levels.leaderboard(guildId, user.sub, Number(limit) || 50, Number(offset) || 0);
  }

  @Get('me')
  me(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.levels.getMember(guildId, user.sub, user.sub);
  }

  @Get('members/:userId')
  member(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.levels.getMember(guildId, user.sub, userId);
  }

  @Get('config')
  async config(@Param('guildId') guildId: string) {
    return this.levels.getConfig(guildId);
  }

  @Patch('config')
  updateConfig(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: Partial<Omit<GuildLevelConfigDto, 'guildId'>>,
  ) {
    return this.levels.updateConfig(guildId, user.sub, body ?? {});
  }

  @Post('config/resync-rewards')
  resync(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.levels.resyncRewards(guildId, user.sub);
  }
}
