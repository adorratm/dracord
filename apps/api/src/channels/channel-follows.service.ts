import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import type { ChannelFollowDto } from '@dracord/types';
import { Channel } from '@/database/entities/channel.entity';
import { ChannelFollow } from '@/database/entities/channel-follow.entity';
import { Guild } from '@/database/entities/guild.entity';
import { ChannelType } from '@/database/enums';
import { GuildsService } from '@/guilds/guilds.service';
import { ChannelsService } from './channels.service';

const MAX_FOLLOWERS = 200;

/** B8 — follow an announcement channel from another server */
@Injectable()
export class ChannelFollowsService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly channels: ChannelsService,
  ) {}

  private async dtos(rows: ChannelFollow[]): Promise<ChannelFollowDto[]> {
    if (rows.length === 0) return [];
    const chIds = [...new Set(rows.flatMap((r) => [r.sourceChannelId, r.targetChannelId]))];
    const chans = await this.em.find(Channel, { where: { id: In(chIds) }, select: { id: true, name: true, guildId: true } });
    const gIds = [...new Set(chans.map((c) => c.guildId).filter((x): x is string => !!x))];
    const guilds = gIds.length ? await this.em.find(Guild, { where: { id: In(gIds) }, select: { id: true, name: true } }) : [];
    const ch = (id: string) => chans.find((c) => c.id === id);
    const gName = (id: string | null | undefined) => guilds.find((g) => g.id === id)?.name ?? '';
    return rows.map((r) => ({
      id: r.id,
      sourceChannelId: r.sourceChannelId,
      sourceChannelName: ch(r.sourceChannelId)?.name ?? '',
      sourceGuildName: gName(ch(r.sourceChannelId)?.guildId),
      targetChannelId: r.targetChannelId,
      targetChannelName: ch(r.targetChannelId)?.name ?? '',
      targetGuildId: r.targetGuildId,
      targetGuildName: gName(r.targetGuildId),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** who follows this announcement channel (its managers) */
  async listFollowers(sourceChannelId: string, userId: string): Promise<ChannelFollowDto[]> {
    const src = await this.em.findOne(Channel, { where: { id: sourceChannelId } });
    if (!src?.guildId) throw new NotFoundException('Channel not found');
    await this.guilds.requirePermission(src.guildId, userId, 'MANAGE_CHANNELS');
    return this.dtos(await this.em.find(ChannelFollow, { where: { sourceChannelId }, order: { createdAt: 'ASC' } }));
  }

  /** what this channel follows (its managers) */
  async listFollowing(targetChannelId: string, userId: string): Promise<ChannelFollowDto[]> {
    const tgt = await this.em.findOne(Channel, { where: { id: targetChannelId } });
    if (!tgt?.guildId) throw new NotFoundException('Channel not found');
    await this.guilds.requirePermission(tgt.guildId, userId, 'MANAGE_CHANNELS');
    return this.dtos(await this.em.find(ChannelFollow, { where: { targetChannelId }, order: { createdAt: 'ASC' } }));
  }

  async follow(sourceChannelId: string, userId: string, targetChannelId: string): Promise<ChannelFollowDto> {
    // must be able to read the announcements…
    const src = await this.channels.assertChannelAccess(sourceChannelId, userId);
    if (!src.guildId || !src.isAnnouncement) throw new BadRequestException('Bu kanal duyuru kanalı değil');
    // …and manage the channel they will land in
    const tgt = await this.em.findOne(Channel, { where: { id: String(targetChannelId ?? '') } });
    if (!tgt?.guildId) throw new NotFoundException('Hedef kanal bulunamadı');
    if (tgt.type !== ChannelType.TEXT) throw new BadRequestException('Hedef bir metin kanalı olmalı');
    if (tgt.id === src.id) throw new BadRequestException('Kanal kendini takip edemez');
    await this.guilds.requirePermission(tgt.guildId, userId, 'MANAGE_CHANNELS');
    if (await this.em.findOne(ChannelFollow, { where: { sourceChannelId, targetChannelId: tgt.id } })) {
      throw new BadRequestException('Bu kanal zaten takip ediliyor');
    }
    if ((await this.em.count(ChannelFollow, { where: { sourceChannelId } })) >= MAX_FOLLOWERS) {
      throw new BadRequestException('Bu duyuru kanalının takipçi sınırı doldu');
    }
    const row = await this.em.save(
      ChannelFollow,
      this.em.create(ChannelFollow, { sourceChannelId, targetChannelId: tgt.id, targetGuildId: tgt.guildId, createdById: userId }),
    );
    return (await this.dtos([row]))[0]!;
  }

  async unfollow(id: string, userId: string): Promise<{ ok: true }> {
    const row = await this.em.findOne(ChannelFollow, { where: { id } });
    if (!row) throw new NotFoundException('Takip bulunamadı');
    const src = await this.em.findOne(Channel, { where: { id: row.sourceChannelId }, select: { id: true, guildId: true } });
    const canTarget = await this.guilds.memberHasPermission(row.targetGuildId, userId, 'MANAGE_CHANNELS');
    const canSource = src?.guildId ? await this.guilds.memberHasPermission(src.guildId, userId, 'MANAGE_CHANNELS') : false;
    const owner = (await this.em.count(Guild, { where: [{ id: row.targetGuildId, ownerId: userId }, ...(src?.guildId ? [{ id: src.guildId, ownerId: userId }] : [])] })) > 0;
    if (!canTarget && !canSource && !owner) throw new ForbiddenException('Bu takibi kaldırma iznin yok');
    await this.em.delete(ChannelFollow, { id });
    return { ok: true };
  }
}
