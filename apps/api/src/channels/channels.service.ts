import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { ChannelSummary, VoiceMemberSummary } from '@dracord/types';
import { GuildsService } from '../guilds/guilds.service';
import { Channel } from '../database/entities/channel.entity';
import { DMChannelMember } from '../database/entities/dm-channel-member.entity';
import { ChannelType } from '../database/enums';
import { VoicePresenceService } from '../voice/voice-presence.service';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly voicePresence: VoicePresenceService,
  ) {}

  async listGuildChannels(guildId: string, userId: string): Promise<ChannelSummary[]> {
    await this.guilds.ensureMember(guildId, userId);
    const channels = await this.em.find(Channel, {
      where: { guildId },
      order: { categoryId: 'ASC', position: 'ASC' },
    });
    const voiceMap = await this.voicePresence.listGuildVoice(guildId);
    return channels.map((c) =>
      this.toSummary(c, c.type === ChannelType.VOICE ? voiceMap[c.id] : undefined),
    );
  }

  async getChannel(channelId: string, userId: string): Promise<ChannelSummary> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.guildId) {
      await this.guilds.ensureMember(channel.guildId, userId);
    } else if (channel.dmChannelId) {
      const member = await this.em.findOne(DMChannelMember, {
        where: { dmChannelId: channel.dmChannelId, userId },
      });
      if (!member) throw new ForbiddenException('Not a participant in this DM');
    }
    let voiceMembers: VoiceMemberSummary[] | undefined;
    if (channel.type === ChannelType.VOICE && channel.guildId) {
      voiceMembers = await this.voicePresence.listChannel(channel.guildId, channel.id);
    }
    return this.toSummary(channel, voiceMembers);
  }

  async createChannel(
    guildId: string,
    userId: string,
    data: {
      name: string;
      type: 'TEXT' | 'VOICE';
      categoryId?: string | null;
      topic?: string | null;
    },
  ): Promise<ChannelSummary> {
    await this.guilds.requireOwner(guildId, userId);
    const name =
      data.type === 'VOICE'
        ? data.name.trim().slice(0, 100)
        : data.name.trim().replace(/\s+/g, '-').toLowerCase().slice(0, 100);
    if (!name) throw new BadRequestException('Kanal adı gerekli');
    const last = await this.em.findOne(Channel, {
      where: { guildId },
      order: { position: 'DESC' },
    });
    const maxPos = last?.position ?? -1;
    const channel = await this.em.save(
      Channel,
      this.em.create(Channel, {
        guildId,
        name,
        type: data.type === 'VOICE' ? ChannelType.VOICE : ChannelType.TEXT,
        categoryId: data.categoryId ?? null,
        topic: data.topic ?? null,
        position: maxPos + 1,
      }),
    );
    return this.toSummary(channel);
  }

  async updateChannel(
    channelId: string,
    userId: string,
    data: { name?: string; topic?: string | null; categoryId?: string | null },
  ): Promise<ChannelSummary> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel?.guildId) throw new NotFoundException('Channel not found');
    await this.guilds.requireOwner(channel.guildId, userId);
    if (data.name != null) {
      channel.name = data.name.trim().replace(/\s+/g, '-').toLowerCase();
    }
    if (data.topic !== undefined) channel.topic = data.topic;
    if (data.categoryId !== undefined) channel.categoryId = data.categoryId;
    await this.em.save(Channel, channel);
    return this.toSummary(channel);
  }

  async deleteChannel(channelId: string, userId: string): Promise<void> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel?.guildId) throw new NotFoundException('Channel not found');
    await this.guilds.requireOwner(channel.guildId, userId);
    await this.em.remove(Channel, channel);
  }

  private toSummary(
    channel: {
      id: string;
      guildId: string | null;
      name: string;
      type: ChannelSummary['type'];
      categoryId: string | null;
      position: number;
      topic?: string | null;
    },
    voiceMembers?: VoiceMemberSummary[],
  ): ChannelSummary {
    return {
      id: channel.id,
      guildId: channel.guildId,
      name: channel.name,
      type: channel.type,
      categoryId: channel.categoryId,
      position: channel.position,
      topic: channel.topic ?? null,
      voiceMembers,
    };
  }
}
