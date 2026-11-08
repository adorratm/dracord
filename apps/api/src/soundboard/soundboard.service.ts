import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { SOUNDBOARD_LIMITS, type GuildSoundDto } from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { GuildSound } from '@/database/entities/guild-sound.entity';
import { GuildsService } from '@/guilds/guilds.service';
import { UploadsService } from '@/uploads/uploads.service';

@Injectable()
export class SoundboardService {
  /** userId → son çalma */
  private readonly lastPlay = new Map<string, number>();

  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly uploads: UploadsService,
  ) {}

  private toDto(s: GuildSound): GuildSoundDto {
    return {
      id: s.id,
      guildId: s.guildId,
      name: s.name,
      emoji: s.emoji,
      url: s.url,
      contentType: s.contentType,
      durationSec: s.durationSec,
      volume: s.volume,
      createdById: s.createdById,
      createdAt: s.createdAt.toISOString(),
    };
  }

  async list(guildId: string, userId: string): Promise<GuildSoundDto[]> {
    await this.guilds.ensureMember(guildId, userId);
    const rows = await this.em.find(GuildSound, { where: { guildId }, order: { createdAt: 'ASC' } });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    guildId: string,
    userId: string,
    input: { name: string; emoji?: string | null; url: string; contentType: string; durationSec: number; volume?: number },
  ): Promise<GuildSoundDto> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    const name = String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, SOUNDBOARD_LIMITS.nameMax);
    if (!name) throw new BadRequestException('Ses adı gerekli');
    if (!String(input.contentType ?? '').startsWith('audio/')) throw new BadRequestException('Yalnızca ses dosyası');
    if (!this.uploads.isOwnPublicUrl(input.url, { folder: 'sounds', userId })) {
      throw new BadRequestException('Ses önce Dracord’a yüklenmeli');
    }
    const dur = Number(input.durationSec);
    if (!Number.isFinite(dur) || dur <= 0 || dur > SOUNDBOARD_LIMITS.maxDurationSec) {
      throw new BadRequestException(`Ses en fazla ${SOUNDBOARD_LIMITS.maxDurationSec} sn olabilir`);
    }
    const count = await this.em.count(GuildSound, { where: { guildId } });
    if (count >= SOUNDBOARD_LIMITS.maxSoundsPerGuild) {
      throw new BadRequestException(`En fazla ${SOUNDBOARD_LIMITS.maxSoundsPerGuild} ses eklenebilir`);
    }
    const emoji = input.emoji ? [...String(input.emoji).trim()].slice(0, 2).join('') || null : null;
    const vol = Math.min(1, Math.max(0.05, Number(input.volume ?? 1) || 1));
    const row = await this.em.save(
      GuildSound,
      this.em.create(GuildSound, {
        guildId,
        name,
        emoji,
        url: input.url,
        contentType: input.contentType,
        durationSec: Math.round(dur * 100) / 100,
        volume: vol,
        createdById: userId,
      }),
    );
    return this.toDto(row);
  }

  async update(
    guildId: string,
    soundId: string,
    userId: string,
    patch: { name?: string; emoji?: string | null; volume?: number },
  ): Promise<GuildSoundDto> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    const row = await this.em.findOne(GuildSound, { where: { id: soundId, guildId } });
    if (!row) throw new NotFoundException('Ses bulunamadı');
    if (patch.name !== undefined) {
      const n = String(patch.name).replace(/\s+/g, ' ').trim().slice(0, SOUNDBOARD_LIMITS.nameMax);
      if (n) row.name = n;
    }
    if (patch.emoji !== undefined) row.emoji = patch.emoji ? [...String(patch.emoji).trim()].slice(0, 2).join('') || null : null;
    if (patch.volume !== undefined) row.volume = Math.min(1, Math.max(0.05, Number(patch.volume) || 1));
    return this.toDto(await this.em.save(GuildSound, row));
  }

  async remove(guildId: string, soundId: string, userId: string): Promise<{ ok: true }> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    await this.em.delete(GuildSound, { id: soundId, guildId });
    return { ok: true };
  }

  /** Çalma isteği doğrula (gateway) */
  async resolvePlay(guildId: string, soundId: string, userId: string): Promise<GuildSound> {
    const now = Date.now();
    const last = this.lastPlay.get(userId) ?? 0;
    if (now - last < SOUNDBOARD_LIMITS.playCooldownMs) throw new BadRequestException('rate_limited');
    const row = await this.em.findOne(GuildSound, { where: { id: soundId, guildId } });
    if (!row) throw new NotFoundException('not_found');
    this.lastPlay.set(userId, now);
    if (this.lastPlay.size > 10_000) this.lastPlay.clear();
    return row;
  }
}
