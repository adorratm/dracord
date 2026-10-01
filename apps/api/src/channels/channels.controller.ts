import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ChannelsService } from './channels.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get('guilds/:guildId/channels')
  listGuildChannels(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.channelsService.listGuildChannels(guildId, user.sub);
  }

  @Post('guilds/:guildId/channels')
  create(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      name: string;
      type: 'TEXT' | 'VOICE' | 'FORUM';
      categoryId?: string | null;
      topic?: string | null;
    },
  ) {
    return this.channelsService.createChannel(guildId, user.sub, body);
  }

  @Patch('guilds/:guildId/channels/reorder')
  reorder(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { items: Array<{ id: string; position: number; categoryId?: string | null }> },
  ) {
    return this.channelsService.reorderChannels(guildId, user.sub, body.items ?? []);
  }

  @Get('channels/:channelId')
  getChannel(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.channelsService.getChannel(channelId, user.sub);
  }

  @Patch('channels/:channelId')
  update(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      name?: string;
      topic?: string | null;
      categoryId?: string | null;
      position?: number;
      locked?: boolean;
      password?: string | null;
      deniedUserIds?: string[];
      permissionOverwrites?: Array<{
        id: string;
        type: 'role' | 'member';
        allow: string[];
        deny: string[];
      }> | null;
    },
  ) {
    return this.channelsService.updateChannel(channelId, user.sub, body);
  }

  @Delete('channels/:channelId')
  remove(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.channelsService.deleteChannel(channelId, user.sub);
  }
}
