import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { DmCallMode } from '@dracord/types';
import { DmCallService } from './dm-call.service';
import { DmService } from './dm.service';

@Controller('dm')
@UseGuards(JwtAuthGuard)
export class DmController {
  constructor(
    private readonly dm: DmService,
    private readonly calls: DmCallService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser) {
    return this.dm.listForUser(user.sub);
  }

  /** Spesifik route’lar :userId’den önce */
  @Get('channels/:channelId/members')
  listMembers(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
  ) {
    return this.calls.listMembers(channelId, user.sub);
  }

  @Post('channels/:channelId/members')
  addMember(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
    @Body() body: { userId: string },
  ) {
    return this.calls.addMember(channelId, user.sub, body?.userId);
  }

  @Delete('channels/:channelId/members/:userId')
  removeMember(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.calls.removeMember(channelId, user.sub, targetUserId);
  }

  @Get('channels/:channelId/calls')
  getCall(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
  ) {
    return this.calls.getActiveCall(channelId, user.sub);
  }

  @Post('channels/:channelId/calls')
  startCall(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
    @Body() body: { mode?: DmCallMode },
  ) {
    return this.calls.startCall(channelId, user.sub, body?.mode ?? 'audio');
  }

  @Post('channels/:channelId/calls/invite')
  invite(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
    @Body() body: { userId: string },
  ) {
    return this.calls.inviteToCall(channelId, user.sub, body?.userId);
  }

  @Post('channels/:channelId/calls/remove')
  removeFromCall(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
    @Body() body: { userId: string },
  ) {
    return this.calls.removeFromCall(channelId, user.sub, body?.userId);
  }

  @Post('channels/:channelId/calls/decline')
  decline(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
  ) {
    return this.calls.declineCall(channelId, user.sub);
  }

  @Post(':userId')
  open(@CurrentUser() user: JwtPayloadUser, @Param('userId') userId: string) {
    return this.dm.openOrCreate(user.sub, userId);
  }
}
