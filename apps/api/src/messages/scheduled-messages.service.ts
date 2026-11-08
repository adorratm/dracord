import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In, LessThanOrEqual } from 'typeorm';
import {
  SCHEDULED_MESSAGE_LIMITS,
  type MessageAttachment,
  type ScheduledMessageDto,
} from '@dracord/types';
import { ChannelsService } from '@/channels/channels.service';
import { Channel } from '@/database/entities/channel.entity';
import { ScheduledMessage } from '@/database/entities/scheduled-message.entity';
import { AutomodService } from '@/moderation/automod.service';
import { NotificationsRealtimeService } from '@/notifications/notifications-realtime.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { MessagesService } from './messages.service';

const MAX_CONTENT = 4000;
const MAX_ATTEMPTS = 3;

/**
 * Zamanlanmış mesajlar. Gönderim: REMINDERS_TICK (20 sn) → fireDue().
 * Gönderim anında izinler / otomod MessagesService.createMessage ile yeniden kontrol edilir.
 */
@Injectable()
export class ScheduledMessagesService {
  private readonly log = new Logger(ScheduledMessagesService.name);
  private firing = false;

  constructor(
    private readonly em: EntityManager,
    private readonly channels: ChannelsService,
    private readonly messages: MessagesService,
    private readonly automod: AutomodService,
    private readonly notifications: NotificationsService,
    private readonly notificationsRealtime: NotificationsRealtimeService,
  ) {}

  private parseSendAt(iso: string): Date {
    const d = new Date(iso);
    const t = d.getTime();
    if (!Number.isFinite(t)) throw new BadRequestException('Geçersiz zaman');
    const now = Date.now();
    if (t < now + SCHEDULED_MESSAGE_LIMITS.minDelayMs - 5_000) {
      throw new BadRequestException('Zaman en az 1 dakika sonra olmalı');
    }
    if (t > now + SCHEDULED_MESSAGE_LIMITS.maxDelayMs) {
      throw new BadRequestException('En fazla 30 gün sonrası zamanlanabilir');
    }
    return d;
  }

  private async assertCanSend(channelId: string, userId: string): Promise<Channel> {
    const ch = await this.channels.assertChannelAccess(channelId, userId);
    if (ch.guildId) {
      const ok = await this.channels.memberCanInChannel(ch, userId, 'SEND_MESSAGES');
      if (!ok) throw new ForbiddenException('Bu kanala mesaj gönderme iznin yok');
    }
    return ch;
  }

  private toDto(row: ScheduledMessage, channelName: string | null): ScheduledMessageDto {
    return {
      id: row.id,
      channelId: row.channelId,
      guildId: row.guildId,
      channelName,
      content: row.content,
      attachments: row.attachments ?? [],
      replyToId: row.replyToId,
      sendAt: row.sendAt.toISOString(),
      status: row.status === 'sending' ? 'pending' : row.status,
      sentMessageId: row.sentMessageId,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async create(
    channelId: string,
    userId: string,
    input: {
      content?: string;
      sendAt: string;
      attachments?: MessageAttachment[];
      replyToId?: string;
    },
  ): Promise<ScheduledMessageDto> {
    const content = (input.content ?? '').trim();
    const attachments = (input.attachments ?? []).slice(0, 10);
    if (!content && !attachments.length) throw new BadRequestException('Mesaj boş olamaz');
    if (content.length > MAX_CONTENT) throw new BadRequestException('Mesaj çok uzun');
    const sendAt = this.parseSendAt(input.sendAt);
    const ch = await this.assertCanSend(channelId, userId);
    // Erken uyarı: otomod şimdi de reddediyorsa zamanlama
    await this.automod.assertMessageAllowed(content, ch.guildId);
    const pending = await this.em.count(ScheduledMessage, {
      where: { userId, status: 'pending' },
    });
    if (pending >= SCHEDULED_MESSAGE_LIMITS.maxPendingPerUser) {
      throw new BadRequestException(
        `En fazla ${SCHEDULED_MESSAGE_LIMITS.maxPendingPerUser} bekleyen zamanlanmış mesaj olabilir`,
      );
    }
    const row = await this.em.save(
      ScheduledMessage,
      this.em.create(ScheduledMessage, {
        userId,
        channelId,
        guildId: ch.guildId ?? null,
        content,
        attachments: attachments.length ? attachments : null,
        replyToId: input.replyToId ?? null,
        sendAt,
        status: 'pending',
        sentMessageId: null,
        error: null,
        attempts: 0,
      }),
    );
    return this.toDto(row, ch.name ?? null);
  }

  async list(
    userId: string,
    opts?: { channelId?: string; includeDone?: boolean },
  ): Promise<ScheduledMessageDto[]> {
    const rows = await this.em.find(ScheduledMessage, {
      where: {
        userId,
        ...(opts?.channelId ? { channelId: opts.channelId } : {}),
        ...(opts?.includeDone ? {} : { status: 'pending' as const }),
      },
      order: { sendAt: 'ASC' },
      take: 100,
    });
    if (!rows.length) return [];
    const chs = await this.em.find(Channel, {
      where: { id: In([...new Set(rows.map((r) => r.channelId))]) },
    });
    const names = new Map(chs.map((c) => [c.id, c.name ?? null]));
    return rows.map((r) => this.toDto(r, names.get(r.channelId) ?? null));
  }

  private async getOwnPending(id: string, userId: string): Promise<ScheduledMessage> {
    const row = await this.em.findOne(ScheduledMessage, { where: { id } });
    if (!row || row.userId !== userId) throw new NotFoundException('Zamanlanmış mesaj bulunamadı');
    if (row.status !== 'pending') throw new BadRequestException('Bu mesaj artık düzenlenemez');
    return row;
  }

  async update(
    id: string,
    userId: string,
    input: { content?: string; sendAt?: string },
  ): Promise<ScheduledMessageDto> {
    const row = await this.getOwnPending(id, userId);
    if (input.content !== undefined) {
      const content = input.content.trim();
      if (!content && !(row.attachments?.length)) throw new BadRequestException('Mesaj boş olamaz');
      if (content.length > MAX_CONTENT) throw new BadRequestException('Mesaj çok uzun');
      await this.automod.assertMessageAllowed(content, row.guildId);
      row.content = content;
    }
    if (input.sendAt !== undefined) row.sendAt = this.parseSendAt(input.sendAt);
    const saved = await this.em.save(ScheduledMessage, row);
    const ch = await this.em.findOne(Channel, { where: { id: row.channelId } });
    return this.toDto(saved, ch?.name ?? null);
  }

  async cancel(id: string, userId: string): Promise<{ ok: true }> {
    const row = await this.getOwnPending(id, userId);
    row.status = 'cancelled';
    await this.em.save(ScheduledMessage, row);
    return { ok: true };
  }

  /** Şimdi gönder (zamanı beklemeden) */
  async sendNow(id: string, userId: string): Promise<ScheduledMessageDto> {
    const row = await this.getOwnPending(id, userId);
    const claimed = await this.em
      .createQueryBuilder()
      .update(ScheduledMessage)
      .set({ status: 'sending' })
      .where('id = :id AND status = :st', { id: row.id, st: 'pending' })
      .execute();
    if (!claimed.affected) throw new BadRequestException('Mesaj zaten gönderiliyor');
    await this.deliver(row);
    const ch = await this.em.findOne(Channel, { where: { id: row.channelId } });
    return this.toDto(row, ch?.name ?? null);
  }

  private async deliver(row: ScheduledMessage): Promise<void> {
    try {
      const { message } = await this.messages.createMessage(
        row.channelId,
        row.userId,
        row.content,
        row.attachments ?? undefined,
        undefined,
        { replyToId: row.replyToId ?? undefined },
      );
      row.status = 'sent';
      row.sentMessageId = message.id;
      row.error = null;
    } catch (e) {
      row.attempts += 1;
      const msg = e instanceof Error ? e.message : String(e);
      row.error = msg.slice(0, 240);
      // İzin / otomod / kanal yok → tekrar deneme anlamsız
      const permanent =
        e instanceof ForbiddenException ||
        e instanceof NotFoundException ||
        e instanceof BadRequestException;
      if (permanent || row.attempts >= MAX_ATTEMPTS) {
        row.status = 'failed';
        await this.notifyFailed(row).catch(() => undefined);
      } else {
        row.status = 'pending';
      }
    }
    await this.em.save(ScheduledMessage, row);
  }

  private async notifyFailed(row: ScheduledMessage) {
    const link = row.guildId
      ? `/channels/${row.guildId}/${row.channelId}`
      : `/channels/me/${row.channelId}`;
    const created = await this.notifications.createMany([
      {
        userId: row.userId,
        type: 'SYSTEM',
        title: 'Zamanlanmış mesaj gönderilemedi',
        body: `${(row.content || 'Ek').slice(0, 80)} — ${row.error ?? 'bilinmeyen hata'}`,
        link,
        guildId: row.guildId,
        channelId: row.channelId,
        messageId: null,
        actorId: null,
      },
    ]);
    this.notificationsRealtime.emitMany(created);
  }

  /** Zamanı gelenleri gönder — tek seferde en fazla 50, eşzamanlı tick koruması */
  async fireDue(): Promise<number> {
    if (this.firing) return 0;
    this.firing = true;
    try {
      const now = new Date();
      const due = await this.em.find(ScheduledMessage, {
        where: [
          { status: 'pending', sendAt: LessThanOrEqual(now) },
          // Gönderirken çöken instance: 5 dk sonra tekrar dene
          { status: 'sending', updatedAt: LessThanOrEqual(new Date(now.getTime() - 5 * 60_000)) },
        ],
        order: { sendAt: 'ASC' },
        take: 50,
      });
      for (const row of due) {
        // Çoklu API instance: pending → sending atomik geçişi ile sahiplen (çift gönderim yok)
        const claimed = await this.em
          .createQueryBuilder()
          .update(ScheduledMessage)
          .set({ status: 'sending' })
          .where('id = :id AND status = :st', { id: row.id, st: row.status })
          .execute();
        if (!claimed.affected) continue;
        await this.deliver(row);
      }
      return due.length;
    } catch (e) {
      this.log.warn(`Scheduled fire failed: ${e instanceof Error ? e.message : e}`);
      return 0;
    } finally {
      this.firing = false;
    }
  }
}
