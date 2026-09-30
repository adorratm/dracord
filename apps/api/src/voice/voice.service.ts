import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { EntityManager } from 'typeorm';
import type { VoiceTokenResponse } from '@dracord/types';
import { ChannelsService } from '@/channels/channels.service';
import { User } from '@/database/entities/user.entity';
import { ChannelType } from '@/database/enums';

@Injectable()
export class VoiceService {
  constructor(
    private readonly config: ConfigService,
    private readonly em: EntityManager,
    private readonly channels: ChannelsService,
  ) {}

  async createToken(
    userId: string,
    channelId: string,
    password?: string | null,
  ): Promise<VoiceTokenResponse> {
    const channel = await this.channels.assertVoiceAccess(channelId, userId, password);
    if (channel.type !== ChannelType.VOICE) {
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

    const roomName = `dracord-voice-${channelId}`;
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
}
