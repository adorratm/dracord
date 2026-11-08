import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull, LessThanOrEqual, MoreThan } from 'typeorm';
import type { CatchupDto, CatchupMessageRef } from '@dracord/types';
import { ChannelsService } from '@/channels/channels.service';
import { ChannelReadState } from '@/database/entities/channel-read-state.entity';
import { Message } from '@/database/entities/message.entity';
import { Notification } from '@/database/entities/notification.entity';
import { Reaction } from '@/database/entities/reaction.entity';

const MAX_SCAN = 500;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const URL_RE = /https?:\/\/[^\s<>()]+/gi;

/**
 * "Ne kaçırdım?" — son okumadan bu yana kanalın kural tabanlı özeti.
 * Model / API yok → maliyet sıfır. İstemci isterse transcript'i cihazında özetler.
 */
@Injectable()
export class CatchupService {
  constructor(
    private readonly em: EntityManager,
    private readonly channels: ChannelsService,
  ) {}

  private ref(m: Message, reactionCount?: number): CatchupMessageRef {
    const content = (m.content || '').trim();
    return {
      id: m.id,
      authorId: m.authorId,
      authorName: m.author?.displayName ?? 'Kullanıcı',
      avatarUrl: m.author?.avatarUrl ?? null,
      contentPreview: content.startsWith('sticker:')
        ? '[çıkartma]'
        : content.slice(0, 160) || (m.attachments?.length ? `[${m.attachments.length} ek]` : ''),
      createdAt: m.createdAt.toISOString(),
      reactionCount,
    };
  }

  async getCatchup(
    channelId: string,
    userId: string,
    sinceIso?: string,
    afterMessageId?: string,
    /** Açılış anındaki okunmamış sayısı + açılış zamanı (çapa id yoksa) */
    lastN?: number,
    untilIso?: string,
  ): Promise<CatchupDto> {
    await this.channels.getChannel(channelId, userId);
    const floor = new Date(Date.now() - MAX_AGE_MS);
    let since: Date | null = sinceIso ? new Date(sinceIso) : null;
    // İstemci kanalı açtığı andaki son okunan mesajı verir (okundu işareti yarışını önler)
    if ((!since || !Number.isFinite(since.getTime())) && afterMessageId) {
      const after = await this.em.findOne(Message, { where: { id: afterMessageId, channelId } });
      if (after) since = after.createdAt;
    }
    if ((!since || !Number.isFinite(since.getTime())) && lastN && lastN > 0) {
      const until = untilIso ? new Date(untilIso) : new Date();
      const nth = await this.em.find(Message, {
        where: { channelId, deletedAt: IsNull(), createdAt: LessThanOrEqual(Number.isFinite(until.getTime()) ? until : new Date()) },
        order: { createdAt: 'DESC' },
        skip: Math.min(Math.floor(lastN), MAX_SCAN) - 1,
        take: 1,
      });
      if (nth[0]) since = new Date(nth[0].createdAt.getTime() - 1);
    }
    if (!since || !Number.isFinite(since.getTime())) {
      const state = await this.em.findOne(ChannelReadState, { where: { userId, channelId } });
      if (state?.lastReadMessageId) {
        const last = await this.em.findOne(Message, { where: { id: state.lastReadMessageId } });
        since = last?.createdAt ?? state.lastReadAt ?? null;
      }
      since ??= new Date(Date.now() - 24 * 60 * 60 * 1000);
    }
    if (since < floor) since = floor;

    const where = { channelId, deletedAt: IsNull(), createdAt: MoreThan(since) };
    const totalNew = await this.em.count(Message, { where });
    // En yeni MAX_SCAN mesaj (kronolojik sıraya çevrilecek)
    const rows = (
      await this.em.find(Message, {
        where,
        relations: { author: true },
        order: { createdAt: 'DESC' },
        take: MAX_SCAN,
      })
    ).reverse();
    const out: CatchupDto = {
      channelId,
      since: since.toISOString(),
      totalNew,
      mentions: [],
      topReacted: [],
      pinned: [],
      polls: [],
      links: [],
      participants: [],
      transcript: [],
    };
    if (!rows.length) return out;
    const ids = rows.map((r) => r.id);
    const byId = new Map(rows.map((r) => [r.id, r]));

    // Bahsetmeler (bildirim kayıtlarından — @kullanıcı, @everyone, yanıt)
    const notes = await this.em.find(Notification, {
      where: { userId, channelId, type: 'MENTION', createdAt: MoreThan(since) },
      order: { createdAt: 'ASC' },
      take: 20,
    });
    for (const n of notes) {
      const m = n.messageId ? byId.get(n.messageId) : undefined;
      if (m && m.authorId !== userId) out.mentions.push(this.ref(m));
    }
    // Bana yanıtlar
    const mineIds = new Set(
      (
        await this.em.find(Message, {
          where: { channelId, authorId: userId, deletedAt: IsNull() },
          select: { id: true },
          order: { createdAt: 'DESC' },
          take: 200,
        })
      ).map((m) => m.id),
    );
    for (const m of rows) {
      if (m.replyToId && mineIds.has(m.replyToId) && m.authorId !== userId && !out.mentions.some((x) => x.id === m.id)) {
        out.mentions.push(this.ref(m));
      }
    }
    out.mentions = out.mentions.slice(0, 10);

    // Tepkiler
    const reactions = await this.em
      .createQueryBuilder(Reaction, 'r')
      .select('r.messageId', 'messageId')
      .addSelect('COUNT(*)', 'c')
      .where('r.messageId IN (:...ids)', { ids })
      .groupBy('r.messageId')
      .orderBy('c', 'DESC')
      .limit(5)
      .getRawMany<{ messageId: string; c: string }>();
    for (const r of reactions) {
      const m = byId.get(r.messageId);
      if (m && Number(r.c) >= 2) out.topReacted.push(this.ref(m, Number(r.c)));
    }

    const counts = new Map<string, { name: string; avatarUrl: string | null; count: number }>();
    const seenUrls = new Set<string>();
    for (const m of rows) {
      if (m.pinnedAt && m.pinnedAt > since) out.pinned.push(this.ref(m));
      if (m.poll) out.polls.push(this.ref(m));
      const c = counts.get(m.authorId) ?? {
        name: m.author?.displayName ?? 'Kullanıcı',
        avatarUrl: m.author?.avatarUrl ?? null,
        count: 0,
      };
      c.count += 1;
      counts.set(m.authorId, c);
      for (const url of (m.content || '').match(URL_RE) ?? []) {
        const clean = url.replace(/[.,!?)]+$/, '');
        if (seenUrls.has(clean) || out.links.length >= 8) continue;
        seenUrls.add(clean);
        out.links.push({ url: clean, messageId: m.id, authorName: m.author?.displayName ?? 'Kullanıcı' });
      }
    }
    out.pinned = out.pinned.slice(0, 5);
    out.polls = out.polls.slice(0, 5);
    out.participants = [...counts.entries()]
      .map(([uid, v]) => ({ userId: uid, name: v.name, avatarUrl: v.avatarUrl, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    out.transcript = rows
      .slice(-150)
      .map((m) => {
        const t = (m.content || '').replace(/\s+/g, ' ').trim();
        if (!t || t.startsWith('sticker:')) return '';
        return `${m.author?.displayName ?? 'Kullanıcı'}: ${t.slice(0, 220)}`;
      })
      .filter(Boolean);
    return out;
  }
}
