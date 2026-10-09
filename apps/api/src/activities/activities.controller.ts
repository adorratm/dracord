import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ActivitiesService } from './activities.service';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get('channel')
  getForChannel(
    @Req() req: { user: { sub: string } },
    @Query('guildId') guildId: string,
    @Query('channelId') channelId: string,
    /** @deprecated eski istemciler */
    @Query('voiceChannelId') voiceChannelId?: string,
  ) {
    return this.activities.getActiveForChannel(
      guildId,
      channelId || voiceChannelId || '',
      req.user.sub,
    );
  }

  @Post()
  start(
    @Req() req: { user: { sub: string } },
    @Body()
    body: { guildId: string; channelId?: string; voiceChannelId?: string },
  ) {
    return this.activities.start(
      body.guildId,
      body.channelId || body.voiceChannelId || '',
      req.user.sub,
    );
  }

  @Post(':id/join')
  join(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { spectator?: boolean },
  ) {
    return this.activities.join(id, req.user.sub, Boolean(body?.spectator));
  }

  @Post(':id/leave')
  leave(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.activities.leave(id, req.user.sub);
  }

  @Patch(':id/state')
  patchState(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.activities.patchState(id, req.user.sub, body ?? {});
  }

  @Post(':id/end')
  end(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.activities.end(id, req.user.sub);
  }
}
