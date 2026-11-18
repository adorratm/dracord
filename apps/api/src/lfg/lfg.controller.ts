import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { LfgService } from './lfg.service';

type AuthedReq = { user: { sub: string } };

/** C5 — /guilds/:guildId/lfg + /lfg/:id/{join,leave} */
@Controller()
@UseGuards(JwtAuthGuard)
export class LfgController {
  constructor(private readonly lfg: LfgService) {}

  @Get('guilds/:guildId/lfg')
  list(@Param('guildId') guildId: string, @Req() req: AuthedReq) {
    return this.lfg.list(guildId, req.user.sub);
  }

  @Post('guilds/:guildId/lfg')
  create(@Param('guildId') guildId: string, @Req() req: AuthedReq, @Body() body: unknown) {
    return this.lfg.create(guildId, req.user.sub, body);
  }

  @Post('lfg/:id/join')
  join(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.lfg.join(id, req.user.sub);
  }

  @Post('lfg/:id/leave')
  leave(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.lfg.leave(id, req.user.sub);
  }

  @Delete('lfg/:id')
  close(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.lfg.close(id, req.user.sub);
  }
}
