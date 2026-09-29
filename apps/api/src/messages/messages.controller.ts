import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateMessageDto } from './dto/create-message.dto';
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
  ) {
    const parsed = limit ? Number(limit) : 50;
    return this.messagesService.listChannelMessages(
      channelId,
      user.sub,
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  @Post('channels/:channelId/messages')
  create(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.createMessage(
      channelId,
      user.sub,
      dto.content,
      dto.attachments,
    );
  }
}
