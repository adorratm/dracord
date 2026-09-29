import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ChannelsService } from '@/channels/channels.service';
import { ChatGateway } from '@/gateway/chat.gateway';
import { VoiceTokenDto } from '@/voice/dto/voice-token.dto';
import { VoicePresenceService } from './voice-presence.service';
import { VoiceService } from './voice.service';

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceController {
  constructor(
    private readonly voiceService: VoiceService,
    private readonly presence: VoicePresenceService,
    private readonly channels: ChannelsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('token')
  token(@CurrentUser() user: JwtPayloadUser, @Body() dto: VoiceTokenDto) {
    return this.voiceService.createToken(user.sub, dto.channelId, dto.password);
  }

  @Post('state')
  async join(
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: { channelId: string; muted?: boolean; deafened?: boolean; password?: string },
  ) {
    await this.channels.assertVoiceAccess(body.channelId, user.sub, body.password);
    const channel = await this.channels.getChannel(body.channelId, user.sub);
    if (!channel.guildId) {
      return null;
    }
    return this.presence.join(channel.guildId, body.channelId, user.sub, {
      muted: body.muted,
      deafened: body.deafened,
    });
  }

  @Patch('state')
  async update(
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: { channelId: string; muted?: boolean; deafened?: boolean },
  ) {
    const channel = await this.channels.getChannel(body.channelId, user.sub);
    if (!channel.guildId) return null;
    return this.presence.updateFlags(channel.guildId, body.channelId, user.sub, {
      muted: body.muted,
      deafened: body.deafened,
    });
  }

  @Delete('state/:channelId')
  async leave(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
  ) {
    const channel = await this.channels.getChannel(channelId, user.sub);
    if (!channel.guildId) return null;
    return this.presence.leave(channel.guildId, channelId, user.sub);
  }

  @Post('heartbeat')
  async heartbeat(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { channelId: string },
  ) {
    const channel = await this.channels.getChannel(body.channelId, user.sub);
    if (!channel.guildId) return { ok: false };
    const ok = await this.presence.heartbeat(channel.guildId, body.channelId, user.sub);
    return { ok };
  }

  /** Yetkili: kullanıcıyı odadan at ve odaya girişini engelle */
  @Post('channels/:channelId/deny')
  async deny(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
    @Body() body: { userId: string },
  ) {
    const summary = await this.channels.denyUserFromVoice(channelId, user.sub, body.userId);
    if (summary.guildId) {
      const payload = await this.presence.leave(summary.guildId, channelId, body.userId);
      if (payload) this.chatGateway.broadcastVoiceState(payload);
    }
    return summary;
  }

  @Post('channels/:channelId/allow')
  async allow(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
    @Body() body: { userId: string },
  ) {
    return this.channels.allowUserVoice(channelId, user.sub, body.userId);
  }
}
