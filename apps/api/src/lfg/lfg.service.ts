import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull, MoreThan } from 'typeorm';
import { SocketEvents, type CreateLfgInput, type LfgListingDto } from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { Channel } from '@/database/entities/channel.entity';
import { LfgListing } from '@/database/entities/lfg-listing.entity';
import { ChannelType } from '@/database/enums';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
import { GuildsService } from '@/guilds/guilds.service';

const MIN_SLOTS = 2;
const MAX_SLOTS = 16;
const DEFAULT_MIN = 120;
const MAX_ACTIVE_PER_GUILD = 60;

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim().slice(0, max);
  return t || null;
};

/** C5 — "takım arıyorum" ilanları: oyun, kişi sayısı, rank, ses → tek tıkla katıl */
@Injectable()
export class LfgService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly broadcast: SocketBroadcastService,
  ) {}

  toDto(l: LfgListing): LfgListingDto {
    return {
      id: l.id,
      guildId: l.guildId,
      authorId: l.authorId,
      game: l.game,
      slots: l.slots,
      memberIds: l.memberIds,
      rank: l.rank,
      note: l.note,
      voice: l.voice,
      voiceChannelId: l.voiceChannelId,
      expiresAt: l.expiresAt.toISOString(),
      createdAt: l.createdAt.toISOString(),
      closed: !!l.closedAt || l.expiresAt.getTime() <= Date.now(),
    };
  }

  private emit(l: LfgListing): LfgListingDto {
    const dto = this.toDto(l);
    this.broadcast.emitToGuild(l.guildId, SocketEvents.LFG_UPDATE, dto);
    return dto;
  }

  async list(guildId: string, userId: string): Promise<LfgListingDto[]> {
    await this.guilds.ensureMember(guildId, userId);
    const rows = await this.em.find(LfgListing, {
      where: { guildId, closedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
      take: MAX_ACTIVE_PER_GUILD,
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(guildId: string, userId: string, raw: unknown): Promise<LfgListingDto> {
    await this.guilds.ensureMember(guildId, userId);
    const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<CreateLfgInput>;
    const game = clean(b.game, 60);
    if (!game) throw new BadRequestException('Oyun adı gerekli');
    const slots = Math.round(Number(b.slots));
    if (!Number.isFinite(slots) || slots < MIN_SLOTS || slots > MAX_SLOTS) {
      throw new BadRequestException(`Kişi sayısı ${MIN_SLOTS}–${MAX_SLOTS} olmalı`);
    }
    const dur = Math.round(Number(b.durationMin ?? DEFAULT_MIN));
    const minutes = Number.isFinite(dur) ? Math.min(480, Math.max(15, dur)) : DEFAULT_MIN;
    let voiceChannelId: string | null = null;
    if (b.voiceChannelId) {
      const ch = await this.em.findOne(Channel, { where: { id: String(b.voiceChannelId), guildId }, select: { id: true, type: true } });
      if (!ch || ch.type !== ChannelType.VOICE) throw new BadRequestException('Ses kanalı bu sunucuda yok');
      voiceChannelId = ch.id;
    }
    // one open listing per person per server: a new one replaces the old
    const mine = await this.em.find(LfgListing, { where: { guildId, authorId: userId, closedAt: IsNull(), expiresAt: MoreThan(new Date()) } });
    for (const m of mine) {
      m.closedAt = new Date();
      await this.em.save(LfgListing, m);
      this.emit(m);
    }
    const active = await this.em.count(LfgListing, { where: { guildId, closedAt: IsNull(), expiresAt: MoreThan(new Date()) } });
    if (active >= MAX_ACTIVE_PER_GUILD) throw new BadRequestException('Bu sunucuda çok fazla açık ilan var');
    const row = await this.em.save(
      LfgListing,
      this.em.create(LfgListing, {
        guildId,
        authorId: userId,
        game,
        slots,
        memberIds: [userId],
        rank: clean(b.rank, 40),
        note: clean(b.note, 200),
        voice: !!b.voice || !!voiceChannelId,
        voiceChannelId,
        expiresAt: new Date(Date.now() + minutes * 60_000),
        closedAt: null,
      }),
    );
    return this.emit(row);
  }

  /** join / leave in a transaction with a row lock: two people cannot take the last slot */
  private async mutate(id: string, userId: string, fn: (l: LfgListing) => void): Promise<LfgListingDto> {
    const saved = await this.em.transaction(async (tx) => {
      const l = await tx.findOne(LfgListing, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!l) throw new NotFoundException('İlan bulunamadı');
      await this.guilds.ensureMember(l.guildId, userId);
      if (l.closedAt || l.expiresAt.getTime() <= Date.now()) throw new BadRequestException('İlan kapandı');
      fn(l);
      return tx.save(LfgListing, l);
    });
    return this.emit(saved);
  }

  join(id: string, userId: string): Promise<LfgListingDto> {
    return this.mutate(id, userId, (l) => {
      if (l.memberIds.includes(userId)) return;
      if (l.memberIds.length >= l.slots) throw new BadRequestException('Takım dolu');
      l.memberIds = [...l.memberIds, userId];
    });
  }

  leave(id: string, userId: string): Promise<LfgListingDto> {
    return this.mutate(id, userId, (l) => {
      if (l.authorId === userId) {
        l.closedAt = new Date(); // the author leaving closes it
        return;
      }
      l.memberIds = l.memberIds.filter((x) => x !== userId);
    });
  }

  async close(id: string, userId: string): Promise<LfgListingDto> {
    const l = await this.em.findOne(LfgListing, { where: { id } });
    if (!l) throw new NotFoundException('İlan bulunamadı');
    if (l.authorId !== userId) {
      const ok = await this.guilds.memberHasPermission(l.guildId, userId, GuildPermissions.MANAGE_MESSAGES);
      if (!ok) throw new ForbiddenException('Yalnız ilan sahibi ya da moderatör kapatabilir');
    }
    l.closedAt = new Date();
    await this.em.save(LfgListing, l);
    return this.emit(l);
  }
}
