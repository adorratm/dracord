import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import type { NotificationDto } from '@dracord/types';
import {
  Notification,
  type NotificationType,
} from '@/database/entities/notification.entity';
import { User } from '@/database/entities/user.entity';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  actorId?: string | null;
  guildId?: string | null;
  channelId?: string | null;
  messageId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly em: EntityManager) {}

  toDto(n: Notification): NotificationDto {
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      actorId: n.actorId,
      guildId: n.guildId,
      channelId: n.channelId,
      messageId: n.messageId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }

  async createMany(inputs: CreateNotificationInput[]): Promise<NotificationDto[]> {
    if (!inputs.length) return [];
    const rows = inputs.map((input) =>
      this.em.create(Notification, {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        actorId: input.actorId ?? null,
        guildId: input.guildId ?? null,
        channelId: input.channelId ?? null,
        messageId: input.messageId ?? null,
      }),
    );
    const saved = await this.em.save(Notification, rows);
    return saved.map((n) => this.toDto(n));
  }

  async listForUser(
    userId: string,
    opts: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<NotificationDto[]> {
    const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
    const where: Record<string, unknown> = { userId };
    if (opts.unreadOnly) where.readAt = IsNull();
    const rows = await this.em.find(Notification, {
      where: where as never,
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((n) => this.toDto(n));
  }

  async unreadCount(userId: string): Promise<number> {
    return this.em.count(Notification, {
      where: { userId, readAt: IsNull() },
    });
  }

  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const row = await this.em.findOne(Notification, { where: { id, userId } });
    if (!row) throw new NotFoundException('Bildirim bulunamadı');
    if (!row.readAt) {
      row.readAt = new Date();
      await this.em.save(Notification, row);
    }
    return this.toDto(row);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.em.update(
      Notification,
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }

  /** Mesaj içeriğindeki @username mention'larını çıkarır (@everyone/@all hariç). */
  extractMentionUsernames(content: string): string[] {
    const matches = content.matchAll(/@([a-zA-Z0-9_]{2,32})\b/g);
    const set = new Set<string>();
    for (const m of matches) {
      const name = m[1]?.toLowerCase();
      if (!name || name === 'everyone' || name === 'all') continue;
      set.add(name);
    }
    return [...set];
  }

  async findUsersByUsernames(usernames: string[]): Promise<User[]> {
    if (!usernames.length) return [];
    const users: User[] = [];
    for (const username of usernames) {
      const u = await this.em
        .createQueryBuilder(User, 'u')
        .where('LOWER(u.username) = LOWER(:username)', { username })
        .getOne();
      if (u) users.push(u);
    }
    return users;
  }
}
