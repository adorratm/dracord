import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { ActivityKind, ActivitySessionDto } from '@dracord/types';
import { ChannelType } from '@/database/enums';
import { ActivitySession } from '@/database/entities/activity-session.entity';
import { Channel } from '@/database/entities/channel.entity';
import { ChannelsService } from '@/channels/channels.service';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
import { SocketEvents } from '@dracord/types';
import { VoicePresenceService } from '@/voice/voice-presence.service';

const CAPACITY: Record<
  ActivityKind,
  { min: number; max: number; spectatorCap: number }
> = {
  billiards: { min: 2, max: 2, spectatorCap: 32 },
  okey: { min: 4, max: 4, spectatorCap: 32 },
  bowling: { min: 2, max: 8, spectatorCap: 32 },
  tavla: { min: 2, max: 2, spectatorCap: 32 },
  watch_party: { min: 1, max: 50, spectatorCap: 200 },
};

const STATE_KEYS: Record<ActivityKind, readonly string[]> = {
  billiards: ['balls', 'turn'],
  okey: ['hands', 'scores', 'turn'],
  bowling: ['frames', 'turn', 'lastRoll'],
  tavla: ['board', 'dice', 'turn'],
  watch_party: ['mediaUrl', 'playing', 'at'],
};

const MAX_STATE_JSON_BYTES = 48_000;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly em: EntityManager,
    private readonly broadcast: SocketBroadcastService,
    private readonly channels: ChannelsService,
    private readonly voicePresence: VoicePresenceService,
  ) {}

  private toDto(s: ActivitySession): ActivitySessionDto {
    return {
      id: s.id,
      guildId: s.guildId,
      voiceChannelId: s.voiceChannelId,
      kind: s.kind,
      hostUserId: s.hostUserId,
      minPlayers: s.minPlayers,
      maxPlayers: s.maxPlayers,
      status: s.status,
      playerIds: s.playerIds ?? [],
      spectatorIds: s.spectatorIds ?? [],
      state: s.state ?? {},
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  /**
   * Ses kanalı CONNECT + (kilitli odada) mevcut voice presence veya şifresiz erişim.
   * Aktivite API’si şifre almadığı için Presence’da olanlar geçer; diğerleri assertVoiceAccess.
   */
  private async assertActivityAccess(
    guildId: string,
    channelId: string,
    userId: string,
  ): Promise<Channel> {
    if (!guildId || !channelId) {
      throw new BadRequestException('guildId ve voiceChannelId gerekli');
    }
    const locations = await this.voicePresence.getUserVoiceLocations(userId);
    const inVoice = locations.some(
      (l) => l.guildId === guildId && l.channelId === channelId,
    );
    if (inVoice) {
      const channel = await this.em.findOne(Channel, {
        where: { id: channelId, guildId },
      });
      if (!channel || channel.type !== ChannelType.VOICE) {
        throw new BadRequestException('Geçerli bir ses kanalı gerekli');
      }
      const denied = channel.deniedUserIds ?? [];
      if (denied.includes(userId)) {
        throw new ForbiddenException('Bu odaya girmen engellendi');
      }
      return channel;
    }
    const channel = await this.channels.assertVoiceAccess(channelId, userId);
    if (channel.guildId !== guildId) {
      throw new ForbiddenException('Kanal bu sunucuya ait değil');
    }
    return channel;
  }

  private sanitizeMediaUrl(raw: unknown): string {
    if (typeof raw !== 'string') {
      throw new BadRequestException('Geçersiz mediaUrl');
    }
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed.length > 2048) {
      throw new BadRequestException('mediaUrl çok uzun');
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException('Geçersiz mediaUrl');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('Yalnızca http(s) medya adresi');
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException('Geçersiz mediaUrl');
    }
    return parsed.toString();
  }

  private sanitizePatch(
    kind: ActivityKind,
    prev: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new BadRequestException('Geçersiz state');
    }
    const allowed = new Set(STATE_KEYS[kind]);
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!allowed.has(key)) continue;
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      out[key] = value;
    }

    if (kind === 'watch_party') {
      if ('mediaUrl' in out) out.mediaUrl = this.sanitizeMediaUrl(out.mediaUrl);
      if ('playing' in out) out.playing = Boolean(out.playing);
      if ('at' in out) {
        const at = Number(out.at);
        if (!Number.isFinite(at) || at < 0) {
          throw new BadRequestException('Geçersiz zaman');
        }
        out.at = Math.min(Math.floor(at * 1000) / 1000, 86_400 * 12);
      }
    } else if ('turn' in out) {
      const turn = Number(out.turn);
      if (!Number.isInteger(turn) || turn < 0 || turn > 1_000_000) {
        throw new BadRequestException('Geçersiz tur');
      }
      const prevTurn = Number(prev.turn ?? 0);
      if (Number.isFinite(prevTurn) && turn > prevTurn + 1) {
        throw new BadRequestException('Tur atlanamaz');
      }
      out.turn = turn;
    }

    const merged = { ...prev, ...out };
    const bytes = Buffer.byteLength(JSON.stringify(merged), 'utf8');
    if (bytes > MAX_STATE_JSON_BYTES) {
      throw new BadRequestException('State çok büyük');
    }
    return out;
  }

  async getActiveForChannel(
    guildId: string,
    voiceChannelId: string,
    userId: string,
  ): Promise<ActivitySessionDto | null> {
    await this.assertActivityAccess(guildId, voiceChannelId, userId);
    const s = await this.em
      .createQueryBuilder(ActivitySession, 'a')
      .where('a.voiceChannelId = :voiceChannelId', { voiceChannelId })
      .andWhere('a.status IN (:...st)', { st: ['lobby', 'playing'] })
      .orderBy('a.createdAt', 'DESC')
      .getOne();
    return s ? this.toDto(s) : null;
  }

  async start(
    guildId: string,
    voiceChannelId: string,
    userId: string,
    kind: ActivityKind,
  ): Promise<ActivitySessionDto> {
    await this.assertActivityAccess(guildId, voiceChannelId, userId);
    const existing = await this.em
      .createQueryBuilder(ActivitySession, 'a')
      .where('a.voiceChannelId = :voiceChannelId', { voiceChannelId })
      .andWhere('a.status IN (:...st)', { st: ['lobby', 'playing'] })
      .getOne();
    if (existing) {
      throw new BadRequestException('Bu kanalda zaten bir aktivite var');
    }
    const cap = CAPACITY[kind];
    if (!cap) throw new BadRequestException('Bilinmeyen aktivite');
    const s = this.em.create(ActivitySession, {
      guildId,
      voiceChannelId,
      kind,
      hostUserId: userId,
      minPlayers: cap.min,
      maxPlayers: cap.max,
      status: 'lobby',
      playerIds: [userId],
      spectatorIds: [],
      state: kind === 'watch_party' ? { mediaUrl: '', playing: false, at: 0 } : { turn: 0 },
    });
    await this.em.save(s);
    const dto = this.toDto(s);
    this.broadcast.emitToChannel(voiceChannelId, SocketEvents.ACTIVITY_UPSERT, dto);
    return dto;
  }

  async join(
    sessionId: string,
    userId: string,
    asSpectator = false,
  ): Promise<ActivitySessionDto> {
    const s = await this.em.findOne(ActivitySession, { where: { id: sessionId } });
    if (!s || s.status === 'ended') throw new NotFoundException('Aktivite yok');
    await this.assertActivityAccess(s.guildId, s.voiceChannelId, userId);

    const players = new Set(s.playerIds ?? []);
    const spectators = new Set(s.spectatorIds ?? []);
    players.delete(userId);
    spectators.delete(userId);

    const cap = CAPACITY[s.kind];
    if (asSpectator || players.size >= s.maxPlayers) {
      if (spectators.size >= cap.spectatorCap) {
        throw new BadRequestException('İzleyici kotası dolu');
      }
      spectators.add(userId);
    } else {
      players.add(userId);
    }
    s.playerIds = [...players];
    s.spectatorIds = [...spectators];
    if (s.status === 'lobby' && s.playerIds.length >= s.minPlayers && s.kind !== 'watch_party') {
      s.status = 'playing';
    }
    if (s.kind === 'watch_party' && s.status === 'lobby') {
      s.status = 'playing';
    }
    await this.em.save(s);
    const dto = this.toDto(s);
    this.broadcast.emitToChannel(s.voiceChannelId, SocketEvents.ACTIVITY_UPSERT, dto);
    return dto;
  }

  async leave(sessionId: string, userId: string): Promise<ActivitySessionDto | null> {
    const s = await this.em.findOne(ActivitySession, { where: { id: sessionId } });
    if (!s || s.status === 'ended') return null;
    s.playerIds = (s.playerIds ?? []).filter((id) => id !== userId);
    s.spectatorIds = (s.spectatorIds ?? []).filter((id) => id !== userId);
    if (s.hostUserId === userId) {
      // Host yalnızca oyunculara devredilir; izleyiciye asla geçmez
      if (s.playerIds.length > 0) {
        s.hostUserId = s.playerIds[0]!;
      } else {
        s.status = 'ended';
      }
    }
    if (s.playerIds.length === 0 && s.spectatorIds.length === 0) {
      s.status = 'ended';
    }
    await this.em.save(s);
    const dto = this.toDto(s);
    this.broadcast.emitToChannel(
      s.voiceChannelId,
      s.status === 'ended' ? SocketEvents.ACTIVITY_LEAVE : SocketEvents.ACTIVITY_UPSERT,
      dto,
    );
    return dto;
  }

  async patchState(
    sessionId: string,
    userId: string,
    patch: Record<string, unknown>,
  ): Promise<ActivitySessionDto> {
    const s = await this.em.findOne(ActivitySession, { where: { id: sessionId } });
    if (!s || s.status === 'ended') throw new NotFoundException('Aktivite yok');
    await this.assertActivityAccess(s.guildId, s.voiceChannelId, userId);

    const isPlayer = (s.playerIds ?? []).includes(userId);
    const isHost = s.hostUserId === userId;
    if (s.kind === 'watch_party' && !isHost) {
      throw new ForbiddenException('Yalnızca moderatör medyayı kontrol eder');
    }
    if (s.kind !== 'watch_party' && !isPlayer && !isHost) {
      throw new ForbiddenException('Oyuncu değilsin');
    }

    const prev = (s.state ?? {}) as Record<string, unknown>;
    const clean = this.sanitizePatch(s.kind, prev, patch);
    if (Object.keys(clean).length === 0) {
      throw new BadRequestException('Güncellenecek alan yok');
    }
    s.state = { ...prev, ...clean };
    if (s.status === 'lobby' && s.kind !== 'watch_party') {
      s.status = 'playing';
    }
    await this.em.save(s);
    const dto = this.toDto(s);
    this.broadcast.emitToChannel(s.voiceChannelId, SocketEvents.ACTIVITY_STATE, dto);
    return dto;
  }

  async end(sessionId: string, userId: string): Promise<ActivitySessionDto> {
    const s = await this.em.findOne(ActivitySession, { where: { id: sessionId } });
    if (!s) throw new NotFoundException('Aktivite yok');
    if (s.hostUserId !== userId) {
      throw new ForbiddenException('Yalnızca host bitirebilir');
    }
    s.status = 'ended';
    await this.em.save(s);
    const dto = this.toDto(s);
    this.broadcast.emitToChannel(s.voiceChannelId, SocketEvents.ACTIVITY_LEAVE, dto);
    return dto;
  }
}
