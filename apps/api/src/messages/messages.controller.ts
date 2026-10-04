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
  CreateMessageDto,
  ForwardMessageDto,
  MarkReadDto,
} from '@/messages/dto/create-message.dto';
import { MessagesService } from './messages.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('channels/:channelId/messages')
  list(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('around') around?: string,
  ) {
    const parsed = limit ? Number(limit) : 50;
    return this.messagesService.listChannelMessages(channelId, user.sub, {
      limit: Number.isFinite(parsed) ? parsed : 50,
      before,
      around,
    });
  }

  @Get('channels/:channelId/threads')
  listChannelThreads(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 5;
    return this.messagesService.listChannelThreads(
      channelId,
      user.sub,
      Number.isFinite(parsed) ? parsed : 5,
    );
  }

  @Get('channels/:channelId/pins')
  listPins(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.messagesService.listPinned(channelId, user.sub);
  }

  @Get('channels/:channelId/read-state')
  readState(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.messagesService.getReadState(channelId, user.sub);
  }

  @Post('channels/:channelId/read')
  markRead(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: MarkReadDto,
  ) {
    return this.messagesService.markChannelRead(channelId, user.sub, {
      messageId: body.messageId,
      unreadFrom: body.unreadFrom,
    });
  }

  @Post('channels/:channelId/messages')
  async create(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateMessageDto,
  ) {
    const { message } = await this.messagesService.createMessage(
      channelId,
      user.sub,
      dto.content ?? '',
      dto.attachments,
      dto.poll,
      { replyToId: dto.replyToId, threadRootId: dto.threadRootId, type: dto.type },
    );
    return message;
  }

  @Get('messages/:messageId/thread')
  listThread(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 100;
    return this.messagesService.listThreadMessages(
      messageId,
      user.sub,
      Number.isFinite(parsed) ? parsed : 100,
    );
  }

  @Patch('messages/:messageId')
  update(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { content: string },
  ) {
    return this.messagesService.updateMessage(messageId, user.sub, body.content ?? '');
  }

  @Delete('messages/:messageId')
  remove(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.messagesService.deleteMessage(messageId, user.sub);
  }

  @Post('messages/:messageId/reactions')
  react(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { emoji: string },
  ) {
    return this.messagesService.toggleReaction(messageId, user.sub, body.emoji ?? '');
  }

  @Post('messages/:messageId/poll/vote')
  vote(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { optionId: string },
  ) {
    return this.messagesService.votePoll(messageId, user.sub, body.optionId ?? '');
  }

  @Post('messages/:messageId/pin')
  pin(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.messagesService.pinMessage(messageId, user.sub);
  }

  @Delete('messages/:messageId/pin')
  unpin(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.messagesService.unpinMessage(messageId, user.sub);
  }

  @Post('messages/:messageId/forward')
  forward(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: ForwardMessageDto,
  ) {
    return this.messagesService.forwardMessage(
      messageId,
      user.sub,
      body.targetChannelId,
      body.content,
    );
  }

  @Post('messages/:messageId/hide')
  hide(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { permanent?: boolean },
  ) {
    return this.messagesService.hideMessage(
      messageId,
      user.sub,
      body.permanent ? 'SUPPRESSED' : 'HIDDEN',
    );
  }

  @Delete('messages/:messageId/hide')
  unhide(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.messagesService.unhideMessage(messageId, user.sub);
  }

  @Post('messages/:messageId/bookmark')
  bookmark(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.messagesService.bookmarkMessage(messageId, user.sub);
  }

  @Delete('messages/:messageId/bookmark')
  unbookmark(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.messagesService.unbookmarkMessage(messageId, user.sub);
  }

  @Get('users/me/bookmarks')
  listBookmarks(
    @CurrentUser() user: JwtPayloadUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 50;
    return this.messagesService.listBookmarks(
      user.sub,
      Number.isFinite(parsed) ? parsed : 50,
    );
  }
}
