import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { GuildInviteDto, GuildSummary } from '@dracord/types';
import { createId } from '@paralleldrive/cuid2';
import { Category } from '../database/entities/category.entity';
import { Channel } from '../database/entities/channel.entity';
import { Guild } from '../database/entities/guild.entity';
import { GuildInvite } from '../database/entities/guild-invite.entity';
import { GuildMember } from '../database/entities/guild-member.entity';
import { ChannelType } from '../database/enums';

@Injectable()
export class GuildsService {
  constructor(private readonly em: EntityManager) {}

  async listForUser(userId: string): Promise<GuildSummary[]> {
    const memberships = await this.em.find(GuildMember, {
      where: { userId },
      relations: { guild: true },
    });
    return memberships.map((m) => this.toSummary(m.guild));
  }

  async discover(): Promise<GuildSummary[]> {
    const guilds = await this.em.find(Guild, {
      where: { discoverable: true },
      take: 50,
      order: { createdAt: 'DESC' },
    });
    const withCounts = await Promise.all(
      guilds.map(async (g) => {
        const memberCount = await this.em.count(GuildMember, {
          where: { guildId: g.id },
        });
        return { ...this.toSummary(g), memberCount };
      }),
    );
    return withCounts;
  }

  async getGuild(guildId: string, userId: string): Promise<GuildSummary> {
    await this.ensureMember(guildId, userId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    return this.toSummary(guild);
  }

  async createGuild(
    userId: string,
    data: { name: string; iconUrl?: string | null; discoverable?: boolean },
  ): Promise<GuildSummary> {
    const name = data.name.trim();
    if (name.length < 2) throw new BadRequestException('Sunucu adı çok kısa');

    const guild = await this.em.save(
      Guild,
      this.em.create(Guild, {
        name,
        iconUrl: data.iconUrl ?? null,
        bannerUrl: null,
        ownerId: userId,
        discoverable: data.discoverable ?? false,
      }),
    );

    await this.em.save(
      GuildMember,
      this.em.create(GuildMember, { guildId: guild.id, userId }),
    );

    const textCat = await this.em.save(
      Category,
      this.em.create(Category, {
        guildId: guild.id,
        name: 'Metin kanalları',
        position: 0,
      }),
    );
    const voiceCat = await this.em.save(
      Category,
      this.em.create(Category, {
        guildId: guild.id,
        name: 'Ses kanalları',
        position: 1,
      }),
    );

    await this.em.save(
      Channel,
      this.em.create(Channel, {
        guildId: guild.id,
        categoryId: textCat.id,
        name: 'genel',
        type: ChannelType.TEXT,
        position: 0,
      }),
    );
    await this.em.save(
      Channel,
      this.em.create(Channel, {
        guildId: guild.id,
        categoryId: voiceCat.id,
        name: 'Genel',
        type: ChannelType.VOICE,
        position: 0,
      }),
    );

    return this.toSummary(guild);
  }

  async updateGuild(
    guildId: string,
    userId: string,
    data: {
      name?: string;
      iconUrl?: string | null;
      bannerUrl?: string | null;
      discoverable?: boolean;
    },
  ): Promise<GuildSummary> {
    await this.ensureMember(guildId, userId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');

    // Keşfedilebilirlik ve silme hariç görsel/ad düzenlemeyi üyeler yapabilir;
    // discoverable yalnızca sahibi değiştirir.
    if (data.discoverable !== undefined) {
      await this.requireOwner(guildId, userId);
      guild.discoverable = data.discoverable;
    }
    if (data.name != null) {
      const trimmed = data.name.trim();
      if (!trimmed) throw new BadRequestException('Sunucu adı boş olamaz');
      guild.name = trimmed;
    }
    if (data.iconUrl !== undefined) guild.iconUrl = data.iconUrl;
    if (data.bannerUrl !== undefined) guild.bannerUrl = data.bannerUrl;
    await this.em.save(Guild, guild);
    return this.toSummary(guild);
  }

  async deleteGuild(guildId: string, userId: string): Promise<void> {
    const guild = await this.requireOwner(guildId, userId);
    await this.em.remove(Guild, guild);
  }

  async createInvite(
    guildId: string,
    userId: string,
    opts?: { maxUses?: number | null; expiresInHours?: number | null },
  ): Promise<GuildInviteDto> {
    await this.ensureMember(guildId, userId);
    const guild = await this.em.findOneOrFail(Guild, { where: { id: guildId } });
    const code = createId().slice(0, 8);
    const expiresAt =
      opts?.expiresInHours != null
        ? new Date(Date.now() + opts.expiresInHours * 3600_000)
        : null;
    const invite = await this.em.save(
      GuildInvite,
      this.em.create(GuildInvite, {
        code,
        guildId,
        creatorId: userId,
        maxUses: opts?.maxUses ?? null,
        uses: 0,
        expiresAt,
      }),
    );
    return this.toInviteDto(invite, guild.name);
  }

  async joinByInvite(code: string, userId: string): Promise<GuildSummary> {
    const invite = await this.em.findOne(GuildInvite, {
      where: { code },
      relations: { guild: true },
    });
    if (!invite) throw new NotFoundException('Davet bulunamadı');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Davet süresi dolmuş');
    }
    if (invite.maxUses != null && invite.uses >= invite.maxUses) {
      throw new BadRequestException('Davet kullanım limiti dolmuş');
    }

    const existing = await this.em.findOne(GuildMember, {
      where: { guildId: invite.guildId, userId },
    });
    if (!existing) {
      await this.em.save(
        GuildMember,
        this.em.create(GuildMember, { guildId: invite.guildId, userId }),
      );
      invite.uses += 1;
      await this.em.save(GuildInvite, invite);
    }
    return this.toSummary(invite.guild);
  }

  async joinDiscoverable(guildId: string, userId: string): Promise<GuildSummary> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (!guild.discoverable) {
      throw new ForbiddenException('Bu sunucu keşiften katılmaya açık değil');
    }
    const existing = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!existing) {
      await this.em.save(
        GuildMember,
        this.em.create(GuildMember, { guildId, userId }),
      );
    }
    return this.toSummary(guild);
  }

  async ensureMember(guildId: string, userId: string): Promise<void> {
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member) throw new ForbiddenException('Not a member of this guild');
  }

  async requireOwner(guildId: string, userId: string): Promise<Guild> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can manage this guild');
    }
    return guild;
  }

  private toSummary(guild: Guild): GuildSummary {
    return {
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconUrl,
      bannerUrl: guild.bannerUrl ?? null,
      ownerId: guild.ownerId,
      discoverable: guild.discoverable,
    };
  }

  private toInviteDto(invite: GuildInvite, guildName: string): GuildInviteDto {
    return {
      code: invite.code,
      guildId: invite.guildId,
      guildName,
      url: `/invite/${invite.code}`,
      maxUses: invite.maxUses,
      uses: invite.uses,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    };
  }
}
