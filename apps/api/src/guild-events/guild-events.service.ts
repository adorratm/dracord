import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { GuildEventDto } from '@dracord/types';
import { GuildEvent } from '@/database/entities/guild-event.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { Guild } from '@/database/entities/guild.entity';

@Injectable()
export class GuildEventsService {
  constructor(private readonly em: EntityManager) {}

  private toDto(e: GuildEvent): GuildEventDto {
    return {
      id: e.id,
      guildId: e.guildId,
      channelId: e.channelId,
      creatorId: e.creatorId,
      title: e.title,
      description: e.description,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt?.toISOString() ?? null,
      location: e.location,
      coverUrl: e.coverUrl,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    };
  }

  private async ensureMember(guildId: string, userId: string): Promise<void> {
    const m = await this.em.findOne(GuildMember, { where: { guildId, userId } });
    if (!m) throw new ForbiddenException('Sunucu üyesi değilsin');
  }

  private async canManage(guildId: string, userId: string): Promise<boolean> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    return Boolean(guild && guild.ownerId === userId);
  }

  async list(guildId: string, userId: string): Promise<GuildEventDto[]> {
    await this.ensureMember(guildId, userId);
    const events = await this.em.find(GuildEvent, {
      where: { guildId },
      order: { startsAt: 'ASC' },
      take: 100,
    });
    return events
      .filter((e) => e.status !== 'cancelled')
      .map((e) => this.toDto(e));
  }

  async create(
    guildId: string,
    userId: string,
    data: {
      title: string;
      description?: string | null;
      startsAt: string;
      endsAt?: string | null;
      location?: string | null;
      coverUrl?: string | null;
      channelId?: string | null;
    },
  ): Promise<GuildEventDto> {
    await this.ensureMember(guildId, userId);
    const title = data.title?.trim();
    if (!title || title.length < 2) {
      throw new BadRequestException('Başlık çok kısa');
    }
    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Geçersiz başlangıç zamanı');
    }
    const endsAt = data.endsAt ? new Date(data.endsAt) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Geçersiz bitiş zamanı');
    }
    const event = await this.em.save(
      GuildEvent,
      this.em.create(GuildEvent, {
        guildId,
        creatorId: userId,
        title,
        description: data.description?.trim() || null,
        startsAt,
        endsAt,
        location: data.location?.trim() || null,
        coverUrl: data.coverUrl?.trim() || null,
        channelId: data.channelId ?? null,
        status: 'scheduled',
      }),
    );
    return this.toDto(event);
  }

  async update(
    guildId: string,
    eventId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      startsAt?: string;
      endsAt?: string | null;
      location?: string | null;
      coverUrl?: string | null;
      channelId?: string | null;
      status?: 'scheduled' | 'cancelled' | 'ended';
    },
  ): Promise<GuildEventDto> {
    await this.ensureMember(guildId, userId);
    const event = await this.em.findOne(GuildEvent, {
      where: { id: eventId, guildId },
    });
    if (!event) throw new NotFoundException('Etkinlik bulunamadı');
    const manage = await this.canManage(guildId, userId);
    if (event.creatorId !== userId && !manage) {
      throw new ForbiddenException('Bu etkinliği düzenleyemezsin');
    }
    if (data.title !== undefined) {
      const t = data.title.trim();
      if (t.length < 2) throw new BadRequestException('Başlık çok kısa');
      event.title = t;
    }
    if (data.description !== undefined) {
      event.description = data.description?.trim() || null;
    }
    if (data.startsAt !== undefined) {
      const d = new Date(data.startsAt);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Geçersiz başlangıç');
      event.startsAt = d;
    }
    if (data.endsAt !== undefined) {
      if (data.endsAt == null) event.endsAt = null;
      else {
        const d = new Date(data.endsAt);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Geçersiz bitiş');
        event.endsAt = d;
      }
    }
    if (data.location !== undefined) event.location = data.location?.trim() || null;
    if (data.coverUrl !== undefined) event.coverUrl = data.coverUrl?.trim() || null;
    if (data.channelId !== undefined) event.channelId = data.channelId;
    if (data.status !== undefined) event.status = data.status;
    await this.em.save(GuildEvent, event);
    return this.toDto(event);
  }

  async remove(guildId: string, eventId: string, userId: string): Promise<void> {
    await this.ensureMember(guildId, userId);
    const event = await this.em.findOne(GuildEvent, {
      where: { id: eventId, guildId },
    });
    if (!event) throw new NotFoundException('Etkinlik bulunamadı');
    const manage = await this.canManage(guildId, userId);
    if (event.creatorId !== userId && !manage) {
      throw new ForbiddenException('Bu etkinliği silemezsin');
    }
    event.status = 'cancelled';
    await this.em.save(GuildEvent, event);
  }
}
