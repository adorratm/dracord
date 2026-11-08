import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import {
  CreateScheduledMessageDto,
  UpdateScheduledMessageDto,
} from '@/messages/dto/create-message.dto';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { CatchupService } from './catchup.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ScheduledMessagesController {
  constructor(
    private readonly scheduled: ScheduledMessagesService,
    private readonly catchup: CatchupService,
  ) {}

  /** "Ne kaçırdım?" — son okumadan bu yana özet (since opsiyonel ISO) */
  @Get('channels/:channelId/catchup')
  getCatchup(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Query('since') since?: string,
    @Query('after') after?: string,
    @Query('lastN') lastN?: string,
    @Query('until') until?: string,
  ) {
    return this.catchup.getCatchup(channelId, user.sub, since, after, Number(lastN) || undefined, until);
  }

  @Post('channels/:channelId/scheduled-messages')
  create(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateScheduledMessageDto,
  ) {
    return this.scheduled.create(channelId, user.sub, dto);
  }

  @Get('channels/:channelId/scheduled-messages')
  listChannel(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.scheduled.list(user.sub, { channelId });
  }

  @Get('users/me/scheduled-messages')
  listMine(@CurrentUser() user: JwtPayloadUser, @Query('all') all?: string) {
    return this.scheduled.list(user.sub, { includeDone: all === '1' || all === 'true' });
  }

  @Patch('users/me/scheduled-messages/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: UpdateScheduledMessageDto,
  ) {
    return this.scheduled.update(id, user.sub, dto);
  }

  @Post('users/me/scheduled-messages/:id/send-now')
  sendNow(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.scheduled.sendNow(id, user.sub);
  }

  @Delete('users/me/scheduled-messages/:id')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.scheduled.cancel(id, user.sub);
  }
}
