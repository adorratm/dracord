import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { TournamentGame } from '@dracord/types';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TournamentsService } from './tournaments.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(private readonly t: TournamentsService) {}

  @Get('guilds/:guildId/tournaments')
  list(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.t.list(guildId, user.sub);
  }

  @Post('guilds/:guildId/tournaments')
  create(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      name: string;
      description?: string | null;
      game: TournamentGame;
      externalGameName?: string | null;
      maxPlayers?: number;
      startsAt?: string | null;
    },
  ) {
    return this.t.create(guildId, user.sub, body);
  }

  @Get('tournaments/:id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.t.get(id, user.sub);
  }

  @Post('tournaments/:id/join')
  join(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.t.join(id, user.sub);
  }

  @Post('tournaments/:id/leave')
  leave(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.t.leave(id, user.sub);
  }

  @Post('tournaments/:id/start')
  start(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.t.start(id, user.sub);
  }

  @Post('tournaments/:id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.t.cancel(id, user.sub);
  }

  @Post('tournaments/:id/kick')
  kick(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser, @Body() body: { userId: string }) {
    return this.t.kick(id, user.sub, String(body?.userId ?? ''));
  }

  @Post('tournaments/:id/matches/:matchId/report')
  report(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { winnerId: string; force?: boolean },
  ) {
    return this.t.report(id, user.sub, matchId, String(body?.winnerId ?? ''), Boolean(body?.force));
  }
}
