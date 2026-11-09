import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, Not, IsNull } from 'typeorm';
import type { GuildBadgeDto, UserShowcaseDto } from '@dracord/types';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { MemberLevel } from '@/database/entities/member-level.entity';
import { User } from '@/database/entities/user.entity';

const CACHE_MS = 60_000;

/** Profil vitrini (B4): kullanıcı üyesi olduğu bir sunucunun rozetini profilinde gösterir. */
@Injectable()
export class ShowcaseService {
  private readonly cache = new Map<string, { at: number; dto: UserShowcaseDto }>();

  constructor(private readonly em: EntityManager) {}

  private toBadge(g: Guild): GuildBadgeDto {
    return {
      guildId: g.id,
      name: g.name,
      iconUrl: g.iconUrl,
      tag: g.badgeTag!,
      emoji: g.badgeEmoji ?? null,
      vanityCode: g.publicPage ? (g.vanityCode ?? null) : null,
    };
  }

  /** Rozeti olan ve üyesi olduğum sunucular */
  async options(userId: string): Promise<{ featuredGuildId: string | null; options: GuildBadgeDto[] }> {
    const [user, memberships] = await Promise.all([
      this.em.findOne(User, { where: { id: userId }, select: { id: true, featuredGuildId: true } }),
      this.em.find(GuildMember, { where: { userId }, select: { guildId: true } }),
    ]);
    const ids = memberships.map((m) => m.guildId);
    const guilds = ids.length
      ? await this.em.find(Guild, { where: { id: In(ids), badgeTag: Not(IsNull()) }, order: { name: 'ASC' } })
      : [];
    return { featuredGuildId: user?.featuredGuildId ?? null, options: guilds.map((g) => this.toBadge(g)) };
  }

  async setFeatured(userId: string, guildId: string | null): Promise<UserShowcaseDto> {
    if (guildId) {
      const [member, guild] = await Promise.all([
        this.em.findOne(GuildMember, { where: { guildId, userId } }),
        this.em.findOne(Guild, { where: { id: guildId } }),
      ]);
      if (!member || !guild) throw new NotFoundException('Bu sunucunun üyesi değilsin');
      if (!guild.badgeTag) throw new BadRequestException('Bu sunucunun rozeti yok');
    }
    await this.em.update(User, { id: userId }, { featuredGuildId: guildId });
    this.cache.delete(userId);
    return this.get(userId);
  }

  async get(userId: string): Promise<UserShowcaseDto> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.dto;
    const user = await this.em.findOne(User, { where: { id: userId }, select: { id: true, featuredGuildId: true } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    let dto: UserShowcaseDto = { userId, badge: null, level: null };
    const gid = user.featuredGuildId;
    if (gid) {
      const [guild, member, level] = await Promise.all([
        this.em.findOne(Guild, { where: { id: gid } }),
        this.em.findOne(GuildMember, { where: { guildId: gid, userId } }),
        this.em.findOne(MemberLevel, { where: { guildId: gid, userId } }),
      ]);
      // Üyelik bitti / rozet kaldırıldı → gösterme
      if (guild?.badgeTag && member) dto = { userId, badge: this.toBadge(guild), level: level?.level ?? null };
    }
    this.cache.set(userId, { at: Date.now(), dto });
    if (this.cache.size > 5000) this.cache.delete(this.cache.keys().next().value!);
    return dto;
  }
}
