import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { FocusService } from './focus.service';

type AuthedReq = { user: { sub: string } };

/** D6 — /channels/:channelId/focus */
@Controller('channels/:channelId/focus')
@UseGuards(JwtAuthGuard)
export class FocusController {
  constructor(private readonly focus: FocusService) {}

  @Get()
  get(@Param('channelId') channelId: string, @Req() req: AuthedReq) {
    return this.focus.get(channelId, req.user.sub);
  }

  @Post()
  start(@Param('channelId') channelId: string, @Req() req: AuthedReq, @Body() body: Record<string, unknown>) {
    return this.focus.start(channelId, req.user.sub, body);
  }

  @Delete()
  stop(@Param('channelId') channelId: string, @Req() req: AuthedReq) {
    return this.focus.stop(channelId, req.user.sub);
  }
}
