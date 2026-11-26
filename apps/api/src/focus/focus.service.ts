import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { SocketEvents, type FocusSessionDto } from '@dracord/types';
import { ChannelsService } from '@/channels/channels.service';
import { FocusSession } from '@/database/entities/focus-session.entity';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';

const int = (v: unknown, min: number, max: number, def: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** D6 — ortak Pomodoro: yalnız başlangıç + ayar saklanır; evre her istemcide focusStateAt ile hesaplanır */
@Injectable()
export class FocusService {
  private readonly last = new Map<string, number>();

  constructor(
    private readonly em: EntityManager,
    private readonly channels: ChannelsService,
    private readonly broadcast: SocketBroadcastService,
  ) {}

  private dto(channelId: string, r: FocusSession | null): FocusSessionDto {
    return {
      channelId,
      startedAt: r?.startedAt ? r.startedAt.toISOString() : null,
      focusMin: r?.focusMin ?? 25,
      breakMin: r?.breakMin ?? 5,
      longBreakMin: r?.longBreakMin ?? 15,
      longEvery: r?.longEvery ?? 4,
      startedBy: r?.startedBy ?? null,
    };
  }

  async get(channelId: string, userId: string): Promise<FocusSessionDto> {
    await this.channels.assertChannelAccess(channelId, userId);
    return this.dto(channelId, await this.em.findOne(FocusSession, { where: { channelId } }));
  }

  private limit(userId: string): void {
    const now = Date.now();
    if (now - (this.last.get(userId) ?? 0) < 3000) throw new HttpException('Biraz bekle', HttpStatus.TOO_MANY_REQUESTS);
    this.last.set(userId, now);
    if (this.last.size > 20_000) this.last.clear();
  }

  async start(
    channelId: string,
    userId: string,
    raw: { focusMin?: unknown; breakMin?: unknown; longBreakMin?: unknown; longEvery?: unknown },
  ): Promise<FocusSessionDto> {
    await this.channels.assertChannelAccess(channelId, userId);
    this.limit(userId);
    const b = raw && typeof raw === 'object' ? raw : {};
    const row = {
      channelId,
      startedAt: new Date(),
      focusMin: int(b.focusMin, 5, 120, 25),
      breakMin: int(b.breakMin, 1, 30, 5),
      longBreakMin: int(b.longBreakMin, 5, 60, 15),
      longEvery: int(b.longEvery, 2, 8, 4),
      startedBy: userId,
    };
    await this.em.upsert(FocusSession, row, ['channelId']);
    const dto = this.dto(channelId, row as FocusSession);
    this.broadcast.emitToChannel(channelId, SocketEvents.FOCUS_EVENT, dto);
    return dto;
  }

  async stop(channelId: string, userId: string): Promise<FocusSessionDto> {
    await this.channels.assertChannelAccess(channelId, userId);
    this.limit(userId);
    await this.em.update(FocusSession, { channelId }, { startedAt: null, startedBy: userId });
    const dto = this.dto(channelId, await this.em.findOne(FocusSession, { where: { channelId } }));
    this.broadcast.emitToChannel(channelId, SocketEvents.FOCUS_EVENT, dto);
    return dto;
  }
}
