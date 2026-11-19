import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { WhiteboardService } from './whiteboard.service';

type AuthedReq = { user: { sub: string } };

/** G3 — /channels/:channelId/whiteboard */
@Controller('channels/:channelId/whiteboard')
@UseGuards(JwtAuthGuard)
export class WhiteboardController {
  constructor(private readonly wb: WhiteboardService) {}

  @Get()
  list(@Param('channelId') channelId: string, @Req() req: AuthedReq) {
    return this.wb.list(channelId, req.user.sub);
  }

  @Post('strokes')
  add(@Param('channelId') channelId: string, @Req() req: AuthedReq, @Body() body: unknown) {
    return this.wb.add(channelId, req.user.sub, body);
  }

  @Post('remove')
  remove(@Param('channelId') channelId: string, @Req() req: AuthedReq, @Body() body: { ids?: unknown }) {
    return this.wb.remove(channelId, req.user.sub, body?.ids);
  }

  @Delete()
  clear(@Param('channelId') channelId: string, @Req() req: AuthedReq) {
    return this.wb.clear(channelId, req.user.sub);
  }
}
