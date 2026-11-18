import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import type { GuildStarboardConfig } from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { Channel } from '@/database/entities/channel.entity';
import { GuildStarboard } from '@/database/entities/guild-starboard.entity';
import { ChannelType } from '@/database/enums';
import { GuildsService } from '@/guilds/guilds.service';

export const STARBOARD_DEFAULT: GuildStarboardConfig = { enabled: false, channelId: null, emoji: '⭐', threshold: 3, ignoredChannelIds: [] };

/** B9 — yıldız panosu ayarları */
@Injectable()
export class StarboardConfigService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
  ) {}

  async get(guildId: string, userId: string): Promise<GuildStarboardConfig> {
    await this.guilds.ensureMember(guildId, userId);
    const r = await this.em.findOne(GuildStarboard, { where: { guildId } });
    return r ? { enabled: r.enabled, channelId: r.channelId, emoji: r.emoji, threshold: r.threshold, ignoredChannelIds: r.ignoredChannelIds } : STARBOARD_DEFAULT;
  }

  async update(guildId: string, userId: string, raw: unknown): Promise<GuildStarboardConfig> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<GuildStarboardConfig>;
    const emoji = typeof b.emoji === 'string' && b.emoji.trim() ? b.emoji.trim().slice(0, 32) : '⭐';
    const t = Math.round(Number(b.threshold ?? 3));
    const threshold = Number.isFinite(t) ? Math.max(1, Math.min(50, t)) : 3;
    const channelId = typeof b.channelId === 'string' && b.channelId ? b.channelId : null;
    const ignored = Array.isArray(b.ignoredChannelIds) ? [...new Set(b.ignoredChannelIds.filter((x): x is string => typeof x === 'string'))].slice(0, 50) : [];
    if (channelId) {
      const ch = await this.em.findOne(Channel, { where: { id: channelId, guildId }, select: { id: true, type: true } });
      if (!ch || ch.type !== ChannelType.TEXT) throw new BadRequestException('Pano bir metin kanalı olmalı');
    }
    if (ignored.length && (await this.em.count(Channel, { where: { id: In(ignored), guildId } })) !== ignored.length) {
      throw new BadRequestException('Kanallardan biri bu sunucuda yok');
    }
    const enabled = !!b.enabled;
    if (enabled && !channelId) throw new BadRequestException('Açmak için bir pano kanalı seç');
    await this.em.save(GuildStarboard, this.em.create(GuildStarboard, { guildId, enabled, channelId, emoji, threshold, ignoredChannelIds: ignored }));
    return { enabled, channelId, emoji, threshold, ignoredChannelIds: ignored };
  }
}
