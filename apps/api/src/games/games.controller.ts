import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { GameAppInput, GameAppStatus } from '@dracord/types';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { GamesService } from './games.service';

/** Kullanıcı / geliştirici uçları */
@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get('catalog')
  catalog(@CurrentUser() u: JwtPayloadUser) {
    return this.games.catalog(u.sub);
  }

  @Get('mine')
  mine(@CurrentUser() u: JwtPayloadUser) {
    return this.games.listMine(u.sub);
  }

  @Post()
  create(@CurrentUser() u: JwtPayloadUser, @Body() body: GameAppInput) {
    return this.games.create(u.sub, body ?? {});
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() u: JwtPayloadUser, @Body() body: GameAppInput) {
    return this.games.update(id, u.sub, body ?? {});
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() u: JwtPayloadUser) {
    return this.games.remove(id, u.sub);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() u: JwtPayloadUser) {
    return this.games.submit(id, u.sub);
  }

  @Post(':id/secret')
  rotate(@Param('id') id: string, @CurrentUser() u: JwtPayloadUser) {
    return this.games.rotateSecret(id, u.sub);
  }

  @Post(':id/testers')
  testers(@Param('id') id: string, @CurrentUser() u: JwtPayloadUser, @Body() body: { usernames?: string[] }) {
    return this.games.setTesters(id, u.sub, body?.usernames ?? []);
  }

  @Get('sessions')
  sessions(@CurrentUser() u: JwtPayloadUser, @Query('guildId') guildId: string, @Query('channelId') channelId: string) {
    return this.games.listChannelSessions(guildId, channelId, u.sub);
  }

  @Post(':id/sessions')
  start(
    @Param('id') id: string,
    @CurrentUser() u: JwtPayloadUser,
    @Body() body: { guildId: string; channelId: string },
  ) {
    return this.games.start(id, body?.guildId, body?.channelId, u.sub);
  }

  @Post('sessions/:sid/join')
  join(@Param('sid') sid: string, @CurrentUser() u: JwtPayloadUser) {
    return this.games.join(sid, u.sub);
  }

  @Post('sessions/:sid/leave')
  leave(@Param('sid') sid: string, @CurrentUser() u: JwtPayloadUser) {
    return this.games.leave(sid, u.sub);
  }

  @Post('sessions/:sid/launch')
  launch(@Param('sid') sid: string, @CurrentUser() u: JwtPayloadUser) {
    return this.games.launch(sid, u.sub);
  }

  // ── Admin (platform admin kontrolü serviste) ──
  @Get('admin/list')
  adminList(@CurrentUser() u: JwtPayloadUser, @Query('status') status?: GameAppStatus) {
    return this.games.adminList(u.sub, status);
  }

  @Post('admin/:id/review')
  adminReview(
    @Param('id') id: string,
    @CurrentUser() u: JwtPayloadUser,
    @Body() body: { action: 'approve' | 'reject' | 'suspend' | 'unsuspend'; note?: string },
  ) {
    return this.games.adminReview(u.sub, id, body?.action, body?.note);
  }
}

/** Oyun sunucusu → Dracord (JWT yok; Authorization: Game <secret>) */
@Controller('v1/games')
export class GamesPublicController {
  constructor(private readonly games: GamesService) {}

  @Post('verify')
  verify(@Headers('authorization') auth: string | undefined, @Body() body: { token?: string }) {
    return this.games.verify(auth, body?.token ?? '');
  }
}
