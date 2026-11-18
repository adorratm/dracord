import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ChannelFollowsService } from './channel-follows.service';

/** B8 — /channels/:id/followers, /channels/:id/following, /channel-follows/:id */
@Controller()
@UseGuards(JwtAuthGuard)
export class ChannelFollowsController {
  constructor(private readonly follows: ChannelFollowsService) {}

  @Get('channels/:channelId/followers')
  followers(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.follows.listFollowers(channelId, user.sub);
  }

  @Get('channels/:channelId/following')
  following(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.follows.listFollowing(channelId, user.sub);
  }

  @Post('channels/:channelId/followers')
  follow(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { targetChannelId?: string },
  ) {
    return this.follows.follow(channelId, user.sub, body?.targetChannelId ?? '');
  }

  @Delete('channel-follows/:id')
  unfollow(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.follows.unfollow(id, user.sub);
  }
}
