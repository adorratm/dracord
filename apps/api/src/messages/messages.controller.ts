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
import { CreateMessageDto } from '@/messages/dto/create-message.dto';
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
    );
    return message;
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
}
