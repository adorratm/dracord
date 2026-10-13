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

const CAPACITY: Record<
  ActivityKind,
  { min: number; max: number; spectatorCap: number }
> = {
  billiards: { min: 2, max: 2, spectatorCap: 32 },
  okey: { min: 4, max: 4, spectatorCap: 32 },
  bowling: { min: 2, max: 8, spectatorCap: 32 },
  tavla: { min: 2, max: 2, spectatorCap: 32 },
  blackjack: { min: 1, max: 4, spectatorCap: 32 },
  watch_party: { min: 1, max: 50, spectatorCap: 200 },
};

const STATE_KEYS: Record<ActivityKind, readonly string[]> = {
  billiards: ['balls', 'turn', 'groups', 'pocketed', 'cueInHand', 'winner', 'shot'],
  okey: ['hands', 'scores', 'turn', 'melds', 'opened'],
  bowling: ['frames', 'turn', 'lastRoll'],
  tavla: ['board', 'dice', 'turn'],
  blackjack: [
    'phase',
    'deck',
    'dealer',
    'holeHidden',
    'seats',
    'turn',
    'round',
    'bank',
    'pendingBets',
    'resultUntil',
  ],
  watch_party: ['mediaUrl', 'playing', 'at'],
};

const MAX_STATE_JSON_BYTES = 48_000;
const GAME_KINDS = new Set(['billiards', 'okey', 'bowling', 'tavla', 'blackjack']);

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly em: EntityManager,
    private readonly broadcast: SocketBroadcastService,
    private readonly channels: ChannelsService,
  ) {}

  private toDto(s: ActivitySession): ActivitySessionDto {
    return {
      id: s.id,
      guildId: s.guildId,
      channelId: s.channelId,
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

  private kindFromChannel(channel: Channel): ActivityKind {
    if (channel.type === ChannelType.WATCH_PARTY) return 'watch_party';
    if (channel.type === ChannelType.GAME && channel.gameKind && GAME_KINDS.has(channel.gameKind)) {
      return channel.gameKind as ActivityKind;
    }
    throw new BadRequestException('Bu kanal bir oyun veya watch party kanalı değil');
  }

  private async assertActivityChannel(
    guildId: string,
    channelId: string,
    userId: string,
  ): Promise<Channel> {
    if (!guildId || !channelId) {
      throw new BadRequestException('guildId ve channelId gerekli');
    }
    const channel = await this.channels.assertChannelAccess(channelId, userId);
    if (channel.guildId !== guildId) {
      throw new ForbiddenException('Kanal bu sunucuya ait değil');
    }
    if (
      channel.type !== ChannelType.GAME &&
      channel.type !== ChannelType.WATCH_PARTY
    ) {
      throw new BadRequestException('Yalnızca oyun / watch party kanallarında aktivite başlar');
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
      if ('mediaUrl' in out) {
        out.mediaUrl = this.sanitizeMediaUrl(out.mediaUrl);
        // Yeni link → oynatmayı sıfırla (patch’te yoksa da)
        if (!('playing' in out)) out.playing = false;
        if (!('at' in out)) out.at = 0;
      }
      if ('playing' in out) out.playing = Boolean(out.playing);
      if ('at' in out) {
        const at = Number(out.at);
        if (!Number.isFinite(at) || at < 0) {
          throw new BadRequestException('Geçersiz zaman');
        }
        out.at = Math.min(Math.floor(at * 1000) / 1000, 86_400 * 12);
      }
    } else if (kind === 'blackjack' && 'turn' in out) {
      // Blackjack: turn = oyuncu userId veya null
      const t = out.turn;
      if (t !== null && (typeof t !== 'string' || t.length < 1 || t.length > 128)) {
        throw new BadRequestException('Geçersiz tur');
      }
      out.turn = t;
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
    channelId: string,
    userId: string,
  ): Promise<ActivitySessionDto | null> {
    await this.assertActivityChannel(guildId, channelId, userId);
    const s = await this.em
      .createQueryBuilder(ActivitySession, 'a')
      .where('a.channelId = :channelId', { channelId })
      .andWhere('a.status IN (:...st)', { st: ['lobby', 'playing'] })
      .orderBy('a.createdAt', 'DESC')
      .getOne();
    return s ? this.toDto(s) : null;
  }

  /** Oyuncu listesinden çıkar; yetersiz oyuncu / boş oda → oturumu bitir */
  private finalizeAfterLeave(s: ActivitySession, userId: string) {
    s.playerIds = (s.playerIds ?? []).filter((id) => id !== userId);
    s.spectatorIds = (s.spectatorIds ?? []).filter((id) => id !== userId);
    if (s.hostUserId === userId) {
      s.hostUserId = s.playerIds[0] ?? s.spectatorIds[0] ?? s.hostUserId;
    }
    const empty =
      s.playerIds.length === 0 && s.spectatorIds.length === 0;
    // Oyunlar: min oyuncu altına düşünce otomatik sonlanır
    const underMin =
      s.kind !== 'watch_party' && s.playerIds.length < s.minPlayers;
    if (empty || underMin) {
      s.status = 'ended';
    }
  }

  private async persistAndBroadcast(s: ActivitySession): Promise<ActivitySessionDto> {
    await this.em.save(s);
    const dto = this.toDto(s);
    this.broadcast.emitToChannel(
      s.channelId,
      s.status === 'ended' ? SocketEvents.ACTIVITY_LEAVE : SocketEvents.ACTIVITY_UPSERT,
      dto,
    );
    return dto;
  }

  /** Kullanıcıyı diğer aktif oturumlardan çıkar (tek oyun kuralı) */
  private async evacuateUser(userId: string, exceptSessionId?: string) {
    const sessions = await this.em
      .createQueryBuilder(ActivitySession, 'a')
      .where('a.status IN (:...st)', { st: ['lobby', 'playing'] })
      .getMany();
    for (const s of sessions) {
      if (exceptSessionId && s.id === exceptSessionId) continue;
      const inSession =
        (s.playerIds ?? []).includes(userId) ||
        (s.spectatorIds ?? []).includes(userId);
      if (!inSession) continue;
      const prevState = (s.state ?? {}) as Record<string, unknown>;
      const joinedMap = {
        ...((prevState.memberJoinedAt as Record<string, string> | undefined) ?? {}),
      };
      delete joinedMap[userId];
      s.state = { ...prevState, memberJoinedAt: joinedMap };
      this.finalizeAfterLeave(s, userId);
      await this.persistAndBroadcast(s);
    }
  }

  /** Ses odasından çıkınca / kick / taşıma — aktivite listesinden de düş */
  async leaveUserFromActivities(userId: string, exceptSessionId?: string) {
    await this.evacuateUser(userId, exceptSessionId);
  }

  async start(
    guildId: string,
    channelId: string,
    userId: string,
  ): Promise<ActivitySessionDto> {
    const channel = await this.assertActivityChannel(guildId, channelId, userId);
    const kind = this.kindFromChannel(channel);
    const existing = await this.em
      .createQueryBuilder(ActivitySession, 'a')
      .where('a.channelId = :channelId', { channelId })
      .andWhere('a.status IN (:...st)', { st: ['lobby', 'playing'] })
      .getOne();
    if (existing) {
      throw new BadRequestException('Bu kanalda zaten bir aktivite var');
    }
    // Önceki oyun / watch party'den otomatik ayrıl
    await this.evacuateUser(userId);
    const cap = CAPACITY[kind];
    if (!cap) throw new BadRequestException('Bilinmeyen aktivite');
    const joinedAt = new Date().toISOString();
    const baseState =
      kind === 'watch_party' ? { mediaUrl: '', playing: false, at: 0 } : { turn: 0 };
    const s = this.em.create(ActivitySession, {
      guildId,
      channelId,
      kind,
      hostUserId: userId,
      minPlayers: cap.min,
      maxPlayers: cap.max,
      status: kind === 'watch_party' ? 'playing' : 'lobby',
      playerIds: [userId],
      spectatorIds: [],
      state: { ...baseState, memberJoinedAt: { [userId]: joinedAt } },
    });
    await this.em.save(s);
    const dto = this.toDto(s);
    this.broadcast.emitToChannel(channelId, SocketEvents.ACTIVITY_UPSERT, dto);
    return dto;
  }

  async join(
    sessionId: string,
    userId: string,
    asSpectator = false,
  ): Promise<ActivitySessionDto> {
    const s = await this.em.findOne(ActivitySession, { where: { id: sessionId } });
    if (!s || s.status === 'ended') throw new NotFoundException('Aktivite yok');
    await this.assertActivityChannel(s.guildId, s.channelId, userId);

    // Başka bir oturumdaysa önce oradan ayrıl
    await this.evacuateUser(userId, sessionId);

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
    const prevState = (s.state ?? {}) as Record<string, unknown>;
    const joinedMap = {
      ...((prevState.memberJoinedAt as Record<string, string> | undefined) ?? {}),
    };
    if (!joinedMap[userId]) joinedMap[userId] = new Date().toISOString();
    s.state = { ...prevState, memberJoinedAt: joinedMap };
    if (s.status === 'lobby' && s.playerIds.length >= s.minPlayers && s.kind !== 'watch_party') {
      s.status = 'playing';
    }
    if (s.kind === 'watch_party' && s.status === 'lobby') {
      s.status = 'playing';
    }
    await this.em.save(s);
    const dto = this.toDto(s);
    this.broadcast.emitToChannel(s.channelId, SocketEvents.ACTIVITY_UPSERT, dto);
    return dto;
  }

  async leave(sessionId: string, userId: string): Promise<ActivitySessionDto | null> {
    const s = await this.em.findOne(ActivitySession, { where: { id: sessionId } });
    if (!s || s.status === 'ended') return null;
    const prevState = (s.state ?? {}) as Record<string, unknown>;
    const joinedMap = {
      ...((prevState.memberJoinedAt as Record<string, string> | undefined) ?? {}),
    };
    delete joinedMap[userId];
    s.state = { ...prevState, memberJoinedAt: joinedMap };
    this.finalizeAfterLeave(s, userId);
    return this.persistAndBroadcast(s);
  }

  async patchState(
    sessionId: string,
    userId: string,
    patch: Record<string, unknown>,
  ): Promise<ActivitySessionDto> {
    const s = await this.em.findOne(ActivitySession, { where: { id: sessionId } });
    if (!s || s.status === 'ended') throw new NotFoundException('Aktivite yok');
    await this.assertActivityChannel(s.guildId, s.channelId, userId);

    const isPlayer = (s.playerIds ?? []).includes(userId);
    const isHost = s.hostUserId === userId;
    if (s.kind === 'watch_party') {
      if (!isHost && !isPlayer) {
        throw new ForbiddenException('Watch party üyesi değilsin');
      }
    } else if (!isPlayer && !isHost) {
      throw new ForbiddenException('Oyuncu değilsin');
    }

    const prev = (s.state ?? {}) as Record<string, unknown>;
    let clean = this.sanitizePatch(s.kind, prev, patch);
    // Watch party: oyuncular link yükleyebilir; play/seek yalnızca host
    if (s.kind === 'watch_party' && !isHost) {
      if (!('mediaUrl' in clean)) {
        throw new ForbiddenException('Oynatma kontrolü yalnızca moderatörde');
      }
      clean = {
        mediaUrl: clean.mediaUrl,
        playing: false,
        at: 0,
      };
    }
    if (Object.keys(clean).length === 0) {
      throw new BadRequestException('Güncellenecek alan yok');
    }
    s.state = { ...prev, ...clean };
    if (s.status === 'lobby' && s.kind !== 'watch_party') {
      s.status = 'playing';
    }
    await this.em.save(s);
    const dto = this.toDto(s);
    this.broadcast.emitToChannel(s.channelId, SocketEvents.ACTIVITY_STATE, dto);
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
    this.broadcast.emitToChannel(s.channelId, SocketEvents.ACTIVITY_LEAVE, dto);
    return dto;
  }
}
