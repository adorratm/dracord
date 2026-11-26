import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  SocketEvents,
  type KanbanBoardDto,
  type KanbanCardDto,
  type KanbanCardInput,
  type KanbanColumnDto,
  type KanbanEvent,
} from '@dracord/types';
import { ChannelsService } from '@/channels/channels.service';
import { GuildPermissions } from '@/common/permissions';
import type { Channel } from '@/database/entities/channel.entity';
import { Guild } from '@/database/entities/guild.entity';
import { KanbanCard, KanbanColumn } from '@/database/entities/kanban.entity';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
import { GuildsService } from '@/guilds/guilds.service';

const MAX_COLUMNS = 12;
const MAX_CARDS = 500;
const BURST = 40; // işlem / 10 sn / kullanıcı
const DEFAULT_COLUMNS = ['Yapılacak', 'Yapılıyor', 'Bitti'];
const COLOR = /^#[0-9a-fA-F]{6}$/;

const clip = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** D5 — kanal panosu: sütunlar + kartlar; herkes kart taşır, sütunları yöneticiler düzenler */
@Injectable()
export class KanbanService {
  private readonly bursts = new Map<string, number[]>();

  constructor(
    private readonly em: EntityManager,
    private readonly channels: ChannelsService,
    private readonly guilds: GuildsService,
    private readonly broadcast: SocketBroadcastService,
  ) {}

  private col(c: KanbanColumn): KanbanColumnDto {
    return { id: c.id, name: c.name, position: c.position, color: c.color };
  }

  private card(c: KanbanCard): KanbanCardDto {
    return {
      id: c.id,
      columnId: c.columnId,
      title: c.title,
      description: c.description,
      assigneeIds: c.assigneeIds ?? [],
      labels: c.labels ?? [],
      dueAt: c.dueAt ? c.dueAt.toISOString() : null,
      position: c.position,
      createdBy: c.createdBy,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private emit(e: KanbanEvent): void {
    this.broadcast.emitToChannel(e.channelId, SocketEvents.KANBAN_EVENT, e);
  }

  private limit(userId: string): void {
    const now = Date.now();
    const recent = (this.bursts.get(userId) ?? []).filter((t) => now - t < 10_000);
    if (recent.length >= BURST) throw new HttpException('Biraz yavaş — çok hızlı düzenliyorsun', HttpStatus.TOO_MANY_REQUESTS);
    this.bursts.set(userId, [...recent, now]);
    if (this.bursts.size > 20_000) this.bursts.clear();
  }

  private async isManager(ch: Channel, userId: string, perm: string): Promise<boolean> {
    if (!ch.guildId) return true; // DM: herkes
    const owner = (await this.em.count(Guild, { where: { id: ch.guildId, ownerId: userId } })) > 0;
    return owner || this.guilds.memberHasPermission(ch.guildId, userId, perm);
  }

  /** düzenleme: kanalda mesaj yazabilen herkes */
  private async assertEdit(channelId: string, userId: string): Promise<Channel> {
    const ch = await this.channels.assertChannelAccess(channelId, userId);
    if (ch.guildId && !(await this.channels.memberCanInChannel(ch, userId, 'SEND_MESSAGES'))) {
      throw new ForbiddenException('Bu kanalda yazma yetkin yok');
    }
    this.limit(userId);
    return ch;
  }

  async board(channelId: string, userId: string): Promise<KanbanBoardDto> {
    const ch = await this.channels.assertChannelAccess(channelId, userId);
    let columns = await this.em.find(KanbanColumn, { where: { channelId }, order: { position: 'ASC' } });
    if (!columns.length) {
      // ilk açılış: varsayılan sütunlar (yarış durumunda ikinci kez oluşmasın diye tekrar kontrol)
      await this.em.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`kanban:${channelId}`]);
        if (await tx.count(KanbanColumn, { where: { channelId } })) return;
        await tx.save(
          KanbanColumn,
          DEFAULT_COLUMNS.map((name, i) => tx.create(KanbanColumn, { channelId, name, position: i + 1, color: null })),
        );
      });
      columns = await this.em.find(KanbanColumn, { where: { channelId }, order: { position: 'ASC' } });
    }
    const cards = await this.em.find(KanbanCard, { where: { channelId }, order: { position: 'ASC' }, take: MAX_CARDS });
    return {
      channelId,
      columns: columns.map((c) => this.col(c)),
      cards: cards.map((c) => this.card(c)),
      canManage: await this.isManager(ch, userId, GuildPermissions.MANAGE_CHANNELS),
    };
  }

  private async cleanInput(ch: Channel, raw: KanbanCardInput, partial: boolean): Promise<Partial<KanbanCard>> {
    const b = (raw && typeof raw === 'object' ? raw : {}) as KanbanCardInput;
    const out: Partial<KanbanCard> = {};
    if (!partial || b.title !== undefined) {
      const title = clip(b.title, 200);
      if (!title) throw new BadRequestException('Kart başlığı gerekli');
      out.title = title;
    }
    if (b.description !== undefined) out.description = clip(b.description, 4000) || null;
    if (b.labels !== undefined) {
      if (!Array.isArray(b.labels)) throw new BadRequestException('Geçersiz etiketler');
      out.labels = [...new Set(b.labels.map((l) => clip(l, 24)).filter(Boolean))].slice(0, 6);
    }
    if (b.assigneeIds !== undefined) {
      if (!Array.isArray(b.assigneeIds)) throw new BadRequestException('Geçersiz atama');
      const ids = [...new Set(b.assigneeIds.filter((x): x is string => typeof x === 'string' && x.length <= 40))].slice(0, 5);
      // sunucu kanalında yalnız üyeler atanabilir
      if (ch.guildId && ids.length) {
        const rows = (await this.em.query(`SELECT "userId" FROM guild_members WHERE "guildId" = $1 AND "userId" = ANY($2)`, [ch.guildId, ids])) as Array<{ userId: string }>;
        const ok = new Set(rows.map((r) => r.userId));
        out.assigneeIds = ids.filter((i) => ok.has(i));
      } else out.assigneeIds = ids;
    }
    if (b.dueAt !== undefined) {
      if (b.dueAt === null || b.dueAt === '') out.dueAt = null;
      else {
        const d = new Date(String(b.dueAt));
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Geçersiz tarih');
        out.dueAt = d;
      }
    }
    if (b.position !== undefined) {
      const p = Number(b.position);
      if (!Number.isFinite(p)) throw new BadRequestException('Geçersiz sıra');
      out.position = p;
    }
    if (b.columnId !== undefined) {
      const col = await this.em.findOne(KanbanColumn, { where: { id: String(b.columnId), channelId: ch.id } });
      if (!col) throw new BadRequestException('Sütun bulunamadı');
      out.columnId = col.id;
    }
    return out;
  }

  async createCard(channelId: string, userId: string, raw: KanbanCardInput): Promise<KanbanCardDto> {
    const ch = await this.assertEdit(channelId, userId);
    if ((await this.em.count(KanbanCard, { where: { channelId } })) >= MAX_CARDS) {
      throw new BadRequestException(`Pano dolu (en fazla ${MAX_CARDS} kart)`);
    }
    const data = await this.cleanInput(ch, raw, false);
    if (!data.columnId) {
      const first = await this.em.findOne(KanbanColumn, { where: { channelId }, order: { position: 'ASC' } });
      if (!first) throw new BadRequestException('Önce panoyu aç');
      data.columnId = first.id;
    }
    if (data.position === undefined) {
      const r = (await this.em.query(`SELECT COALESCE(max(position), 0) + 1 AS p FROM kanban_cards WHERE "columnId" = $1`, [data.columnId])) as Array<{ p: number }>;
      data.position = Number(r[0]?.p ?? 1);
    }
    const row = await this.em.save(
      KanbanCard,
      this.em.create(KanbanCard, { channelId, createdBy: userId, assigneeIds: [], labels: [], description: null, dueAt: null, ...data }),
    );
    const dto = this.card(row);
    this.emit({ channelId, kind: 'card', card: dto });
    return dto;
  }

  async updateCard(channelId: string, userId: string, cardId: string, raw: KanbanCardInput): Promise<KanbanCardDto> {
    const ch = await this.assertEdit(channelId, userId);
    const row = await this.em.findOne(KanbanCard, { where: { id: cardId, channelId } });
    if (!row) throw new NotFoundException('Kart bulunamadı');
    const data = await this.cleanInput(ch, raw, true);
    await this.em.update(KanbanCard, { id: cardId }, data);
    const fresh = await this.em.findOneOrFail(KanbanCard, { where: { id: cardId } });
    const dto = this.card(fresh);
    this.emit({ channelId, kind: 'card', card: dto });
    return dto;
  }

  /** silme: kartı açan ya da mesajları yöneten */
  async deleteCard(channelId: string, userId: string, cardId: string): Promise<{ ok: true }> {
    const ch = await this.assertEdit(channelId, userId);
    const row = await this.em.findOne(KanbanCard, { where: { id: cardId, channelId } });
    if (!row) return { ok: true };
    if (row.createdBy !== userId && !(await this.isManager(ch, userId, GuildPermissions.MANAGE_MESSAGES))) {
      throw new ForbiddenException('Kartı yalnız açan kişi ya da moderatörler silebilir');
    }
    await this.em.delete(KanbanCard, { id: cardId });
    this.emit({ channelId, kind: 'cardRemoved', id: cardId });
    return { ok: true };
  }

  private async assertManage(channelId: string, userId: string): Promise<Channel> {
    const ch = await this.channels.assertChannelAccess(channelId, userId);
    if (!(await this.isManager(ch, userId, GuildPermissions.MANAGE_CHANNELS))) {
      throw new ForbiddenException('Sütunları yalnız kanalları yönetenler düzenleyebilir');
    }
    this.limit(userId);
    return ch;
  }

  async upsertColumn(
    channelId: string,
    userId: string,
    raw: { id?: string; name?: string; color?: string | null; position?: number },
  ): Promise<KanbanColumnDto> {
    await this.assertManage(channelId, userId);
    const b = raw && typeof raw === 'object' ? raw : {};
    const color = b.color === null ? null : typeof b.color === 'string' && COLOR.test(b.color) ? b.color : undefined;
    const pos = b.position !== undefined && Number.isFinite(Number(b.position)) ? Number(b.position) : undefined;
    if (b.id) {
      const row = await this.em.findOne(KanbanColumn, { where: { id: b.id, channelId } });
      if (!row) throw new NotFoundException('Sütun bulunamadı');
      const name = b.name !== undefined ? clip(b.name, 60) : row.name;
      if (!name) throw new BadRequestException('Sütun adı gerekli');
      await this.em.update(KanbanColumn, { id: row.id }, { name, ...(color !== undefined ? { color } : {}), ...(pos !== undefined ? { position: pos } : {}) });
      const dto = this.col(await this.em.findOneOrFail(KanbanColumn, { where: { id: row.id } }));
      this.emit({ channelId, kind: 'column', column: dto });
      return dto;
    }
    const name = clip(b.name, 60);
    if (!name) throw new BadRequestException('Sütun adı gerekli');
    if ((await this.em.count(KanbanColumn, { where: { channelId } })) >= MAX_COLUMNS) {
      throw new BadRequestException(`En fazla ${MAX_COLUMNS} sütun`);
    }
    const r = (await this.em.query(`SELECT COALESCE(max(position), 0) + 1 AS p FROM kanban_columns WHERE "channelId" = $1`, [channelId])) as Array<{ p: number }>;
    const row = await this.em.save(KanbanColumn, this.em.create(KanbanColumn, { channelId, name, color: color ?? null, position: pos ?? Number(r[0]?.p ?? 1) }));
    const dto = this.col(row);
    this.emit({ channelId, kind: 'column', column: dto });
    return dto;
  }

  /** sütunu sil: kartları komşu sütuna taşınır (kayıp yok); son sütun silinemez */
  async deleteColumn(channelId: string, userId: string, columnId: string): Promise<{ ok: true; movedTo: string | null }> {
    await this.assertManage(channelId, userId);
    const cols = await this.em.find(KanbanColumn, { where: { channelId }, order: { position: 'ASC' } });
    const idx = cols.findIndex((c) => c.id === columnId);
    if (idx < 0) return { ok: true, movedTo: null };
    if (cols.length <= 1) throw new BadRequestException('Son sütun silinemez');
    const target = cols[idx === 0 ? 1 : idx - 1]!;
    const moved = await this.em.transaction(async (tx) => {
      await tx.update(KanbanCard, { columnId }, { columnId: target.id });
      await tx.delete(KanbanColumn, { id: columnId });
      return tx.find(KanbanCard, { where: { columnId: target.id } });
    });
    this.emit({ channelId, kind: 'columnRemoved', id: columnId });
    for (const c of moved) this.emit({ channelId, kind: 'card', card: this.card(c) });
    return { ok: true, movedTo: target.id };
  }
}
