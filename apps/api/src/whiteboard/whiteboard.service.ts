import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { SocketEvents, type WhiteboardEvent, type WhiteboardStroke, type WhiteboardTool } from '@dracord/types';
import { ChannelsService } from '@/channels/channels.service';
import { GuildPermissions } from '@/common/permissions';
import { Guild } from '@/database/entities/guild.entity';
import { WhiteboardStrokeRow } from '@/database/entities/whiteboard-stroke.entity';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
import { GuildsService } from '@/guilds/guilds.service';

const MAX_STROKES = 4000;
const MAX_POINTS = 4000; // numbers (= 2000 points)
const BURST = 80; // strokes per user per 10 s
const TOOLS: WhiteboardTool[] = ['pen', 'marker', 'eraser'];

/** keep 3 decimals: enough on any screen, half the bytes */
export function cleanPoints(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_POINTS || raw.length % 2 !== 0) return null;
  const out: number[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const v = Number(raw[i]);
    if (!Number.isFinite(v) || v < -0.05 || v > 1.05) return null;
    out[i] = Math.round(v * 1000) / 1000;
  }
  return out;
}

/** G3 — a shared whiteboard per channel: strokes are stored and broadcast to the channel room */
@Injectable()
export class WhiteboardService {
  private readonly bursts = new Map<string, number[]>();

  constructor(
    private readonly em: EntityManager,
    private readonly channels: ChannelsService,
    private readonly guilds: GuildsService,
    private readonly broadcast: SocketBroadcastService,
  ) {}

  private dto(r: WhiteboardStrokeRow): WhiteboardStroke {
    return {
      id: r.id,
      userId: r.userId,
      tool: r.tool as WhiteboardTool,
      color: r.color,
      width: r.width,
      points: r.points,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private emit(e: WhiteboardEvent): void {
    this.broadcast.emitToChannel(e.channelId, SocketEvents.WHITEBOARD_EVENT, e);
  }

  async list(channelId: string, userId: string): Promise<WhiteboardStroke[]> {
    await this.channels.assertChannelAccess(channelId, userId);
    const rows = await this.em.find(WhiteboardStrokeRow, { where: { channelId }, order: { createdAt: 'ASC' }, take: MAX_STROKES });
    return rows.map((r) => this.dto(r));
  }

  async add(channelId: string, userId: string, raw: unknown): Promise<WhiteboardStroke> {
    await this.channels.assertChannelAccess(channelId, userId);
    const now = Date.now();
    const recent = (this.bursts.get(userId) ?? []).filter((t) => now - t < 10_000);
    if (recent.length >= BURST) throw new HttpException('Çok hızlı çiziyorsun', HttpStatus.TOO_MANY_REQUESTS);
    this.bursts.set(userId, [...recent, now]);
    if (this.bursts.size > 20_000) this.bursts.clear();

    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const tool = TOOLS.includes(b.tool as WhiteboardTool) ? (b.tool as WhiteboardTool) : 'pen';
    const color = typeof b.color === 'string' && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(b.color) ? b.color : '#f8f8f2';
    const w = Number(b.width);
    const width = Number.isFinite(w) ? Math.min(60, Math.max(1, Math.round(w * 10) / 10)) : 4;
    const points = cleanPoints(b.points);
    if (!points) throw new BadRequestException('Geçersiz çizgi');
    if ((await this.em.count(WhiteboardStrokeRow, { where: { channelId } })) >= MAX_STROKES) {
      throw new BadRequestException('Tahta doldu — temizlenmesi gerekiyor');
    }
    const row = await this.em.save(WhiteboardStrokeRow, this.em.create(WhiteboardStrokeRow, { channelId, userId, tool, color, width, points }));
    const stroke = this.dto(row);
    this.emit({ channelId, kind: 'add', stroke });
    return stroke;
  }

  /** undo / eraser: anyone who can see the board may remove strokes (it is shared) */
  async remove(channelId: string, userId: string, ids: unknown): Promise<{ ok: true; removed: number }> {
    await this.channels.assertChannelAccess(channelId, userId);
    const list = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string').slice(0, 500) : [];
    if (!list.length) return { ok: true, removed: 0 };
    const res = await this.em.delete(WhiteboardStrokeRow, { channelId, id: In(list) });
    this.emit({ channelId, kind: 'remove', strokeIds: list });
    return { ok: true, removed: res.affected ?? 0 };
  }

  /** wipe the board: moderators (Manage Messages) or the owner; anyone in a DM */
  async clear(channelId: string, userId: string): Promise<{ ok: true }> {
    const ch = await this.channels.assertChannelAccess(channelId, userId);
    if (ch.guildId) {
      const owner = (await this.em.count(Guild, { where: { id: ch.guildId, ownerId: userId } })) > 0;
      const mod = owner || (await this.guilds.memberHasPermission(ch.guildId, userId, GuildPermissions.MANAGE_MESSAGES));
      if (!mod) throw new ForbiddenException('Tahtayı yalnız mesajları yönetenler temizleyebilir');
    }
    await this.em.delete(WhiteboardStrokeRow, { channelId });
    this.emit({ channelId, kind: 'clear' });
    return { ok: true };
  }
}
