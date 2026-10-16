import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminService } from '@/auth/platform-admin.service';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { DM_CALL_GUILD_ID, type VoiceSyncPayload } from '@dracord/types';
import { ActivitiesService } from '@/activities/activities.service';
import { ChannelsService } from '@/channels/channels.service';
import { DmCallService } from '@/dm/dm-call.service';
import { GuildsService } from '@/guilds/guilds.service';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
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
    private readonly guilds: GuildsService,
    private readonly broadcast: SocketBroadcastService,
    private readonly em: EntityManager,
    private readonly dmCalls: DmCallService,
    private readonly platformAdmin: PlatformAdminService,
    private readonly activities: ActivitiesService,
  ) {}

  private async resolvePresenceGuildId(channelId: string): Promise<string | null> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel) return null;
    if (channel.guildId) return channel.guildId;
    if (channel.dmChannelId) return DM_CALL_GUILD_ID;
    return null;
  }

  private resolveVoiceClient(
    bodyClientId?: string | null,
    bodyPlatform?: string | null,
    headerClientId?: string,
    headerPlatform?: string,
  ) {
    const clientId = (bodyClientId ?? headerClientId)?.trim() || null;
    const platform = (bodyPlatform ?? headerPlatform)?.trim() || null;
    return { clientId, platform };
  }

  private async claimClientAndNotify(
    userId: string,
    guildId: string,
    channelId: string,
    clientId?: string | null,
    platform?: string | null,
  ) {
    if (!clientId?.trim()) return;
    const { previousClientId } = await this.presence.claimActiveClient(
      userId,
      clientId.trim(),
      guildId,
      channelId,
      platform,
    );
    if (previousClientId && previousClientId !== clientId.trim()) {
      this.broadcast.emitVoiceTakeover(userId, {
        clientId: clientId.trim(),
        channelId,
        guildId,
        platform: platform ?? null,
      });
    }
  }

  /** Kanala girmeden sidebar’da kimler var — presence roster */
  @Get('guilds/:guildId/roster')
  async guildRoster(
    @CurrentUser() user: JwtPayloadUser,
    @Param('guildId') guildId: string,
  ): Promise<VoiceSyncPayload> {
    await this.guilds.ensureMember(guildId, user.sub);
    const membersByChannel = await this.presence.listGuildVoice(guildId);
    return { guildId, membersByChannel };
  }

  @Post('token')
  async token(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: VoiceTokenDto,
    @Headers('x-dracord-voice-client') headerClientId?: string,
    @Headers('x-dracord-voice-platform') headerPlatform?: string,
  ) {
    const result = await this.voiceService.createToken(
      user.sub,
      dto.channelId,
      dto.password,
    );
    const guildId = await this.resolvePresenceGuildId(dto.channelId);
    const { clientId, platform } = this.resolveVoiceClient(
      dto.clientId,
      dto.platform,
      headerClientId,
      headerPlatform,
    );
    if (guildId && clientId) {
      await this.claimClientAndNotify(
        user.sub,
        guildId,
        dto.channelId,
        clientId,
        platform,
      );
    }
    return result;
  }

  @Post('state')
  async join(
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      channelId: string;
      muted?: boolean;
      deafened?: boolean;
      password?: string;
      clientId?: string;
      platform?: string;
    },
    @Headers('x-dracord-voice-client') headerClientId?: string,
    @Headers('x-dracord-voice-platform') headerPlatform?: string,
  ) {
    await this.channels.assertVoiceAccess(body.channelId, user.sub, body.password);
    const guildId = await this.resolvePresenceGuildId(body.channelId);
    if (!guildId) return null;
    const { joined, left } = await this.presence.join(guildId, body.channelId, user.sub, {
      muted: body.muted,
      deafened: body.deafened,
    });
    for (const payload of left) {
      this.broadcast.broadcastVoiceState(payload);
      if (payload.guildId === DM_CALL_GUILD_ID && payload.channelId) {
        await this.dmCalls.endCallIfEmpty(payload.channelId);
      }
    }
    this.broadcast.broadcastVoiceState(joined);
    const { clientId, platform } = this.resolveVoiceClient(
      body.clientId,
      body.platform,
      headerClientId,
      headerPlatform,
    );
    await this.claimClientAndNotify(
      user.sub,
      guildId,
      body.channelId,
      clientId,
      platform,
    );
    return joined;
  }

  @Patch('state')
  async update(
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      channelId: string;
      muted?: boolean;
      deafened?: boolean;
      screenSharing?: boolean;
    },
  ) {
    const guildId = await this.resolvePresenceGuildId(body.channelId);
    if (!guildId) return null;
    const updated = await this.presence.updateFlags(guildId, body.channelId, user.sub, {
      muted: body.muted,
      deafened: body.deafened,
      screenSharing: body.screenSharing,
    });
    if (updated) this.broadcast.broadcastVoiceState(updated);
    return updated;
  }

  @Delete('state/:channelId')
  async leave(
    @CurrentUser() user: JwtPayloadUser,
    @Param('channelId') channelId: string,
    @Query('clientId') clientId?: string,
  ) {
    const guildId = await this.resolvePresenceGuildId(channelId);
    if (!guildId) return null;
    const payload = await this.presence.leave(guildId, channelId, user.sub);
    if (payload) this.broadcast.broadcastVoiceState(payload);
    await this.presence.clearActiveClient(user.sub, clientId);
    await this.activities.leaveUserFromActivities(user.sub);
    if (guildId === DM_CALL_GUILD_ID) {
      await this.dmCalls.endCallIfEmpty(channelId);
    }
    return payload;
  }

  @Post('heartbeat')
  async heartbeat(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { channelId: string; clientId?: string },
    @Headers('x-dracord-voice-client') headerClientId?: string,
  ) {
    const guildId = await this.resolvePresenceGuildId(body.channelId);
    if (!guildId) return { ok: false };
    const ok = await this.presence.heartbeat(guildId, body.channelId, user.sub);
    const clientId = (body.clientId ?? headerClientId)?.trim();
    if (ok && clientId) {
      const stillMine = await this.presence.refreshActiveClient(user.sub, clientId);
      if (!stillMine) {
        // Başka istemci aldı — bu istemci LiveKit’i bırakmalı
        return { ok: true, active: false as const };
      }
    }
    return { ok, active: true as const };
  }

  /** Odak / “buraya al” — presence’ı bozmadan LiveKit liderliğini bu istemciye verir */
  @Post('claim')
  async claim(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { channelId: string; clientId?: string; platform?: string },
    @Headers('x-dracord-voice-client') headerClientId?: string,
    @Headers('x-dracord-voice-platform') headerPlatform?: string,
  ) {
    const guildId = await this.resolvePresenceGuildId(body.channelId);
    const { clientId, platform } = this.resolveVoiceClient(
      body.clientId,
      body.platform,
      headerClientId,
      headerPlatform,
    );
    if (!guildId || !clientId) return { ok: false };
    await this.claimClientAndNotify(
      user.sub,
      guildId,
      body.channelId,
      clientId,
      platform,
    );
    return { ok: true };
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
      if (payload) this.broadcast.broadcastVoiceState(payload);
      await this.activities.leaveUserFromActivities(body.userId);
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
    await this.platformAdmin.assertNotPlatformAdminTarget(body.userId);
    const members = await this.presence.listChannel(channel.guildId, channelId);
    const prior = members.find((m) => m.id === body.userId);
    const payload = await this.presence.leave(channel.guildId, channelId, body.userId);
    // Presence’te olmasa bile leave yayınla — hayalet avatar / istemci koparması için
    this.broadcast.broadcastVoiceState(
      payload ?? {
        guildId: channel.guildId,
        channelId,
        action: 'leave',
        user: prior ?? {
          id: body.userId,
          displayName: 'Üye',
          avatarUrl: null,
        },
      },
    );
    try {
      await this.activities.leaveUserFromActivities(body.userId);
    } catch {
      /* ses ayrımı yine başarılı sayılsın */
    }
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
