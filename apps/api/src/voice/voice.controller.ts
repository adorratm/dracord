import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { DM_CALL_GUILD_ID } from '@dracord/types';
import { ChannelsService } from '@/channels/channels.service';
import { DmCallService } from '@/dm/dm-call.service';
import { ChatGateway } from '@/gateway/chat.gateway';
import { Channel } from '@/database/entities/channel.entity';
import { EntityManager } from 'typeorm';
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
    private readonly em: EntityManager,
    private readonly dmCalls: DmCallService,
  ) {}

  private async resolvePresenceGuildId(channelId: string): Promise<string | null> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel) return null;
    if (channel.guildId) return channel.guildId;
    if (channel.dmChannelId) return DM_CALL_GUILD_ID;
    return null;
  }

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
    const guildId = await this.resolvePresenceGuildId(body.channelId);
    if (!guildId) return null;
    const { joined, left } = await this.presence.join(guildId, body.channelId, user.sub, {
      muted: body.muted,
      deafened: body.deafened,
    });
    for (const payload of left) {
      this.chatGateway.broadcastVoiceState(payload);
      if (payload.guildId === DM_CALL_GUILD_ID && payload.channelId) {
        await this.dmCalls.endCallIfEmpty(payload.channelId);
      }
    }
    this.chatGateway.broadcastVoiceState(joined);
    return joined;
  }

  @Patch('state')
  async update(
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: { channelId: string; muted?: boolean; deafened?: boolean },
  ) {
    const guildId = await this.resolvePresenceGuildId(body.channelId);
    if (!guildId) return null;
    return this.presence.updateFlags(guildId, body.channelId, user.sub, {
      muted: body.muted,
      deafened: body.deafened,
    });
  }

  @Delete('state/:channelId')
  async leave(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
  ) {
    const guildId = await this.resolvePresenceGuildId(channelId);
    if (!guildId) return null;
    const payload = await this.presence.leave(guildId, channelId, user.sub);
    if (payload) this.chatGateway.broadcastVoiceState(payload);
    if (guildId === DM_CALL_GUILD_ID) {
      await this.dmCalls.endCallIfEmpty(channelId);
    }
    return payload;
  }

  @Post('heartbeat')
  async heartbeat(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { channelId: string },
  ) {
    const guildId = await this.resolvePresenceGuildId(body.channelId);
    if (!guildId) return { ok: false };
    const ok = await this.presence.heartbeat(guildId, body.channelId, user.sub);
    return { ok };
  }

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

  @Post('channels/:channelId/disconnect')
  async disconnect(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
    @Body() body: { userId: string },
  ) {
    const channel = await this.channels.getChannel(channelId, user.sub);
    if (!channel.guildId) return { ok: false };
    await this.voiceService.assertCanMoveMembers(channel.guildId, user.sub);
    const payload = await this.presence.leave(channel.guildId, channelId, body.userId);
    if (payload) this.chatGateway.broadcastVoiceState(payload);
    return { ok: true };
  }

  @Post('move')
  async move(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { userId: string; targetChannelId: string },
  ) {
    return this.voiceService.moveMember(user.sub, body.userId, body.targetChannelId);
  }
}
