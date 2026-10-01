import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { EntityManager } from 'typeorm';
import type { VoiceTokenResponse } from '@dracord/types';
import { ChannelsService } from '@/channels/channels.service';
import { GuildPermissions } from '@/common/permissions';
import { ChatGateway } from '@/gateway/chat.gateway';
import { Channel } from '@/database/entities/channel.entity';
import { Guild } from '@/database/entities/guild.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType } from '@/database/enums';
import { GuildsService } from '@/guilds/guilds.service';
import { VoicePresenceService } from './voice-presence.service';

@Injectable()
export class VoiceService {
  constructor(
    private readonly config: ConfigService,
    private readonly em: EntityManager,
    private readonly channels: ChannelsService,
    private readonly guilds: GuildsService,
    private readonly presence: VoicePresenceService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async createToken(
    userId: string,
    channelId: string,
    password?: string | null,
  ): Promise<VoiceTokenResponse> {
    const channel = await this.channels.assertVoiceAccess(channelId, userId, password);
    const isDmCall = Boolean(channel.dmChannelId) && channel.type === ChannelType.TEXT;
    if (channel.type !== ChannelType.VOICE && !isDmCall) {
      throw new BadRequestException('Channel is not a voice channel');
    }

    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    const url =
      this.config.get<string>('LIVEKIT_PUBLIC_URL') ??
      this.config.get<string>('LIVEKIT_URL') ??
      'ws://localhost:7880';

    if (!apiKey || !apiSecret) {
      throw new BadRequestException('LiveKit is not configured');
    }

    const roomName = isDmCall
      ? `dracord-dm-${channelId}`
      : `dracord-voice-${channelId}`;
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });

    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: user.displayName,
      metadata: JSON.stringify({
        avatarUrl: user.avatarUrl ?? null,
        username: user.username,
      }),
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();
    return { token: jwt, url, roomName };
  }

  async assertCanMoveMembers(guildId: string, actorId: string): Promise<void> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === actorId) return;
    const allowed =
      (await this.guilds.memberHasPermission(
        guildId,
        actorId,
        GuildPermissions.MOVE_MEMBERS,
      )) ||
      (await this.guilds.memberHasPermission(
        guildId,
        actorId,
        GuildPermissions.MANAGE_CHANNELS,
      )) ||
      (await this.guilds.memberHasPermission(
        guildId,
        actorId,
        GuildPermissions.ADMINISTRATOR,
      ));
    if (!allowed) {
      throw new ForbiddenException('Bu işlem için yetkin yok');
    }
  }

  async moveMember(
    actorId: string,
    targetUserId: string,
    targetChannelId: string,
  ): Promise<{ ok: true; targetChannelId: string }> {
    const target = await this.em.findOne(Channel, { where: { id: targetChannelId } });
    if (!target?.guildId || target.type !== ChannelType.VOICE) {
      throw new BadRequestException('Hedef bir ses kanalı olmalı');
    }
    await this.assertCanMoveMembers(target.guildId, actorId);

    // Hedef kanal erişimi (engel listesi vs.)
    try {
      await this.channels.assertVoiceAccess(targetChannelId, targetUserId);
    } catch {
      throw new BadRequestException('Kullanıcı bu kanala taşınamaz (engel veya şifre)');
    }

    const locations = await this.presence.getUserVoiceLocations(targetUserId);
    const inGuild = locations.filter((l) => l.guildId === target.guildId);
    const fromChannelId = inGuild[0]?.channelId ?? null;

    if (fromChannelId === targetChannelId) {
      return { ok: true, targetChannelId };
    }

    if (fromChannelId) {
      const leavePayload = await this.presence.leave(
        target.guildId,
        fromChannelId,
        targetUserId,
      );
      if (leavePayload) this.chatGateway.broadcastVoiceState(leavePayload);
    }

    const joinResult = await this.presence.join(
      target.guildId,
      targetChannelId,
      targetUserId,
    );
    for (const left of joinResult.left) {
      this.chatGateway.broadcastVoiceState(left);
    }
    this.chatGateway.broadcastVoiceState({
      ...joinResult.joined,
      action: 'move',
      channelId: fromChannelId,
      targetChannelId,
    });
    this.chatGateway.broadcastVoiceState(joinResult.joined);

    return { ok: true, targetChannelId };
  }
}
