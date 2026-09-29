import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In, IsNull, LessThan, MoreThan } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import type {
  MessageAttachment,
  MessageDto,
  MessageEmbed,
  MessagePage,
  MessagePollDto,
  MessageReactionDto,
  NotificationDto,
} from '@dracord/types';
import { toPublicUser } from '@/common/user.mapper';
import { GuildPermissions } from '@/common/permissions';
import { ChannelsService } from '@/channels/channels.service';
import { Channel } from '@/database/entities/channel.entity';
import { Friendship } from '@/database/entities/friendship.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { Message } from '@/database/entities/message.entity';
import { MessageHide } from '@/database/entities/message-hide.entity';
import { Reaction } from '@/database/entities/reaction.entity';
import { User } from '@/database/entities/user.entity';
import { FriendshipStatus } from '@/database/enums';
import { GuildsService } from '@/guilds/guilds.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationsRealtimeService } from '@/notifications/notifications-realtime.service';
import { SearchIndexerService } from '@/search/search-indexer.service';
import { LinkPreviewService } from './link-preview.service';
import { MessagesRealtimeService } from './messages-realtime.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly em: EntityManager,
    private readonly channels: ChannelsService,
    private readonly guilds: GuildsService,
    private readonly indexer: SearchIndexerService,
    private readonly notifications: NotificationsService,
    private readonly notificationsRealtime: NotificationsRealtimeService,
    private readonly linkPreview: LinkPreviewService,
    private readonly realtime: MessagesRealtimeService,
  ) {}

  async listChannelMessages(
    channelId: string,
    userId: string,
    opts: { limit?: number; before?: string; around?: string } = {},
  ): Promise<MessagePage> {
    await this.channels.getChannel(channelId, userId);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);

    if (opts.around) {
      return this.listAround(channelId, userId, opts.around, limit);
    }

    const where: Record<string, unknown> = {
      channelId,
      deletedAt: IsNull(),
    };

    if (opts.before) {
      const cursor = await this.em.findOne(Message, {
        where: { id: opts.before, channelId },
      });
      if (cursor) {
        where.createdAt = LessThan(cursor.createdAt);
      } else {
        const ts = Date.parse(opts.before);
        if (!Number.isNaN(ts)) {
          where.createdAt = LessThan(new Date(ts));
        }
      }
    }

    const messages = await this.em.find(Message, {
      where: where as never,
      relations: { author: true },
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const items = await this.mapMessagesForViewer(page.reverse(), userId);
    return { items, hasMore };
  }

  private async listAround(
    channelId: string,
    userId: string,
    messageId: string,
    limit: number,
  ): Promise<MessagePage> {
    const pivot = await this.em.findOne(Message, {
      where: { id: messageId, channelId, deletedAt: IsNull() },
      relations: { author: true },
    });
    if (!pivot) throw new NotFoundException('Message not found');

    const half = Math.max(1, Math.floor(limit / 2));
    const older = await this.em.find(Message, {
      where: {
        channelId,
        deletedAt: IsNull(),
        createdAt: LessThan(pivot.createdAt),
      },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      take: half,
    });
    const newer = await this.em.find(Message, {
      where: {
        channelId,
        deletedAt: IsNull(),
        createdAt: MoreThan(pivot.createdAt),
      },
      relations: { author: true },
      order: { createdAt: 'ASC' },
      take: half,
    });

    const olderHasMore =
      older.length === half &&
      (await this.em.exists(Message, {
        where: {
          channelId,
          deletedAt: IsNull(),
          createdAt: LessThan(older[older.length - 1]?.createdAt ?? pivot.createdAt),
        },
      }));

    const raw = [...older.reverse(), pivot, ...newer];
    const items = await this.mapMessagesForViewer(raw, userId);
    return { items, hasMore: olderHasMore };
  }

  private async mapMessagesForViewer(
    messages: Message[],
    viewerId: string,
  ): Promise<MessageDto[]> {
    if (!messages.length) return [];
    const blocked = await this.blockedUserIds(viewerId);
    const ids = messages.map((m) => m.id);
    const hides = await this.em.find(MessageHide, {
      where: { userId: viewerId, messageId: In(ids) },
    });
    const hideMap = new Map(hides.map((h) => [h.messageId, h.mode]));
    const reactions = await this.em.find(Reaction, {
      where: { messageId: In(ids) },
    });
    const reactionByMsg = new Map<string, Reaction[]>();
    for (const r of reactions) {
      const list = reactionByMsg.get(r.messageId) ?? [];
      list.push(r);
      reactionByMsg.set(r.messageId, list);
    }

    const out: MessageDto[] = [];
    for (const m of messages) {
      if (blocked.has(m.authorId)) continue;
      const mode = hideMap.get(m.id);
      if (mode === 'SUPPRESSED') continue;
      out.push(
        this.toDto(m, {
          viewerId,
          hideMode: mode === 'HIDDEN' ? 'hidden' : null,
          reactions: reactionByMsg.get(m.id) ?? [],
        }),
      );
    }
    return out;
  }

  private async blockedUserIds(userId: string): Promise<Set<string>> {
    const rows = await this.em.find(Friendship, {
      where: [
        { userId, status: FriendshipStatus.BLOCKED },
        { friendId: userId, status: FriendshipStatus.BLOCKED },
      ],
    });
    const set = new Set<string>();
    for (const r of rows) {
      if (r.status !== FriendshipStatus.BLOCKED) continue;
      set.add(r.userId === userId ? r.friendId : r.userId);
    }
    return set;
  }

  async createMessage(
    channelId: string,
    userId: string,
    content: string,
    attachments?: MessageAttachment[],
    pollInput?: { question: string; options: string[]; multi?: boolean },
  ): Promise<{ message: MessageDto; notifications: NotificationDto[] }> {
    await this.channels.getChannel(channelId, userId);
    const channelRow = await this.em.findOne(Channel, { where: { id: channelId } });
    const trimmed = content.trim();
    let poll: MessagePollStored | null = null;
    if (pollInput) {
      if (channelRow?.guildId) {
        const ok =
          (await this.guilds.memberHasPermission(
            channelRow.guildId,
            userId,
            GuildPermissions.CREATE_POLLS,
          )) ||
          (await this.guilds.memberHasPermission(
            channelRow.guildId,
            userId,
            GuildPermissions.SEND_MESSAGES,
          )) ||
          (await this.guilds.listMyPermissions(channelRow.guildId, userId)).owner;
        // CREATE_POLLS or SEND_MESSAGES or owner — soft: allow members with SEND
        void ok;
      }
      const options = pollInput.options
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);
      if (options.length < 2) {
        throw new BadRequestException('Anket en az 2 seçenek gerektirir');
      }
      const q = pollInput.question.trim();
      if (!q) throw new BadRequestException('Anket sorusu gerekli');
      poll = {
        question: q,
        options: options.map((text) => ({ id: createId().slice(0, 8), text })),
        votes: {},
        multi: Boolean(pollInput.multi),
        closed: false,
      };
    }
    if (!trimmed && (!attachments || attachments.length === 0) && !poll) {
      throw new BadRequestException('Mesaj boş olamaz');
    }
    const embeds = trimmed ? await this.linkPreview.buildEmbeds(trimmed) : [];
    const saved = await this.em.save(
      Message,
      this.em.create(Message, {
        channelId,
        authorId: userId,
        content: trimmed || (poll ? ' ' : ' '),
        attachments: attachments?.length ? attachments : null,
        embeds: embeds.length ? embeds : null,
        poll,
      }),
    );
    const message = await this.em.findOneOrFail(Message, {
      where: { id: saved.id },
      relations: { author: true },
    });
    const dto = this.toDto(message, { viewerId: userId, reactions: [] });
    void this.indexer
      .indexMessage(dto, {
        guildId: channelRow?.guildId ?? null,
        dmChannelId: channelRow?.dmChannelId ?? null,
      })
      .catch(() => undefined);

    const notifications = await this.createMessageNotifications(dto, channelRow, userId);
    this.realtime.emitCreate(channelId, dto);
    return { message: dto, notifications };
  }

  async updateMessage(messageId: string, userId: string, content: string): Promise<MessageDto> {
    const message = await this.em.findOne(Message, {
      where: { id: messageId },
      relations: { author: true },
    });
    if (!message || message.deletedAt) throw new NotFoundException('Mesaj bulunamadı');
    if (message.authorId !== userId) {
      throw new ForbiddenException('Yalnızca kendi mesajını düzenleyebilirsin');
    }
    const trimmed = content.trim();
    if (!trimmed && !message.poll) throw new BadRequestException('Mesaj boş olamaz');
    message.content = trimmed || ' ';
    message.updatedAt = new Date();
    message.embeds = trimmed ? await this.linkPreview.buildEmbeds(trimmed) : null;
    await this.em.save(Message, message);
    const reactions = await this.em.find(Reaction, { where: { messageId } });
    const dto = this.toDto(message, { viewerId: userId, reactions });
    this.realtime.emitUpdate(message.channelId, dto);
    return dto;
  }

  async deleteMessage(messageId: string, userId: string): Promise<{ id: string; channelId: string }> {
    const message = await this.em.findOne(Message, { where: { id: messageId } });
    if (!message || message.deletedAt) throw new NotFoundException('Mesaj bulunamadı');

    const isAuthor = message.authorId === userId;
    let canModerate = false;
    if (!isAuthor) {
      const channel = await this.em.findOne(Channel, { where: { id: message.channelId } });
      if (channel?.guildId) {
        canModerate = await this.guilds.memberHasPermission(
          channel.guildId,
          userId,
          GuildPermissions.MANAGE_MESSAGES,
        );
        if (!canModerate) {
          const perms = await this.guilds.listMyPermissions(channel.guildId, userId);
          canModerate = perms.owner || perms.permissions.includes('ADMINISTRATOR');
        }
      }
    }
    if (!isAuthor && !canModerate) {
      throw new ForbiddenException('Bu mesajı silme yetkin yok');
    }
    message.deletedAt = new Date();
    await this.em.save(Message, message);
    this.realtime.emitDelete(message.channelId, message.id);
    return { id: message.id, channelId: message.channelId };
  }

  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<MessageDto> {
    const clean = emoji.trim().slice(0, 32);
    if (!clean) throw new BadRequestException('Emoji gerekli');
    const message = await this.em.findOne(Message, {
      where: { id: messageId },
      relations: { author: true },
    });
    if (!message || message.deletedAt) throw new NotFoundException('Mesaj bulunamadı');
    await this.channels.getChannel(message.channelId, userId);

    const existing = await this.em.findOne(Reaction, {
      where: { messageId, userId, emoji: clean },
    });
    if (existing) {
      await this.em.remove(Reaction, existing);
    } else {
      await this.em.save(
        Reaction,
        this.em.create(Reaction, { messageId, userId, emoji: clean }),
      );
    }
    const reactions = await this.em.find(Reaction, { where: { messageId } });
    const dto = this.toDto(message, { viewerId: userId, reactions });
    this.realtime.emitUpdate(message.channelId, dto);
    return dto;
  }

  async votePoll(
    messageId: string,
    userId: string,
    optionId: string,
  ): Promise<MessageDto> {
    const message = await this.em.findOne(Message, {
      where: { id: messageId },
      relations: { author: true },
    });
    if (!message || message.deletedAt) throw new NotFoundException('Mesaj bulunamadı');
    if (!message.poll) throw new BadRequestException('Bu mesajda anket yok');
    if (message.poll.closed) throw new BadRequestException('Anket kapalı');
    await this.channels.getChannel(message.channelId, userId);

    const poll = { ...message.poll, votes: { ...message.poll.votes } };
    const opt = poll.options.find((o) => o.id === optionId);
    if (!opt) throw new BadRequestException('Geçersiz seçenek');

    if (!poll.multi) {
      for (const key of Object.keys(poll.votes)) {
        poll.votes[key] = (poll.votes[key] ?? []).filter((id) => id !== userId);
      }
    }
    const list = [...(poll.votes[optionId] ?? [])];
    const idx = list.indexOf(userId);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(userId);
    poll.votes[optionId] = list;
    message.poll = poll;
    await this.em.save(Message, message);
    const reactions = await this.em.find(Reaction, { where: { messageId } });
    const dto = this.toDto(message, { viewerId: userId, reactions });
    this.realtime.emitUpdate(message.channelId, dto);
    return dto;
  }

  async hideMessage(
    messageId: string,
    userId: string,
    mode: 'HIDDEN' | 'SUPPRESSED',
  ): Promise<{ ok: true }> {
    const message = await this.em.findOne(Message, { where: { id: messageId } });
    if (!message || message.deletedAt) throw new NotFoundException('Mesaj bulunamadı');
    await this.channels.getChannel(message.channelId, userId);
    let row = await this.em.findOne(MessageHide, {
      where: { userId, messageId },
    });
    if (!row) {
      row = this.em.create(MessageHide, { userId, messageId, mode });
    } else {
      row.mode = mode;
    }
    await this.em.save(MessageHide, row);
    return { ok: true };
  }

  async unhideMessage(messageId: string, userId: string): Promise<{ ok: true }> {
    const row = await this.em.findOne(MessageHide, {
      where: { userId, messageId, mode: 'HIDDEN' },
    });
    if (row) await this.em.remove(MessageHide, row);
    return { ok: true };
  }

  private async createMessageNotifications(
    message: MessageDto,
    channel: Channel | null,
    authorId: string,
  ): Promise<NotificationDto[]> {
    const inputs: Parameters<NotificationsService['createMany']>[0] = [];
    const snippet = message.content.trim().slice(0, 120) || 'Yeni mesaj';
    const authorName = message.author.displayName;
    const linkBase =
      channel?.guildId
        ? `/channels/${channel.guildId}/${message.channelId}?around=${message.id}`
        : `/channels/@me/${message.channelId}?around=${message.id}`;

    const usernames = this.notifications.extractMentionUsernames(message.content);
    const mentionedIds = new Set<string>();
    if (usernames.length) {
      const mentioned = await this.notifications.findUsersByUsernames(usernames);
      for (const u of mentioned) {
        if (u.id === authorId) continue;
        mentionedIds.add(u.id);
        inputs.push({
          userId: u.id,
          type: 'MENTION',
          title: `${authorName} seni etiketledi`,
          body: snippet,
          link: linkBase,
          actorId: authorId,
          guildId: channel?.guildId ?? null,
          channelId: message.channelId,
          messageId: message.id,
        });
      }
    }

    const everyone =
      /(^|[\s])@(everyone|all)\b/i.test(message.content) && Boolean(channel?.guildId);
    if (everyone && channel?.guildId) {
      const members = await this.em.find(GuildMember, {
        where: { guildId: channel.guildId },
        select: { userId: true },
      });
      for (const m of members) {
        if (m.userId === authorId) continue;
        if (mentionedIds.has(m.userId)) continue;
        mentionedIds.add(m.userId);
        inputs.push({
          userId: m.userId,
          type: 'MENTION',
          title: `${authorName} herkesi etiketledi`,
          body: snippet,
          link: linkBase,
          actorId: authorId,
          guildId: channel.guildId,
          channelId: message.channelId,
          messageId: message.id,
        });
      }
    }

    const channelName = (channel?.name ?? '').toLowerCase();
    const isAnnouncement =
      Boolean(channel?.guildId) &&
      (channelName === 'duyurular' ||
        channelName === 'announcements' ||
        channelName.includes('duyuru'));
    if (isAnnouncement && channel?.guildId) {
      const members = await this.em.find(GuildMember, {
        where: { guildId: channel.guildId },
        select: { userId: true },
      });
      for (const m of members) {
        if (m.userId === authorId) continue;
        if (mentionedIds.has(m.userId)) continue;
        inputs.push({
          userId: m.userId,
          type: 'ANNOUNCEMENT',
          title: `Duyuru: #${channel.name}`,
          body: `${authorName}: ${snippet}`,
          link: linkBase,
          actorId: authorId,
          guildId: channel.guildId,
          channelId: message.channelId,
          messageId: message.id,
        });
      }
    }

    return this.notifications.createMany(inputs).then((created) => {
      this.notificationsRealtime.emitMany(created);
      return created;
    });
  }

  async getMessage(messageId: string, viewerId?: string): Promise<MessageDto> {
    const message = await this.em.findOne(Message, {
      where: { id: messageId },
      relations: { author: true },
    });
    if (!message || message.deletedAt) {
      throw new NotFoundException('Message not found');
    }
    const reactions = await this.em.find(Reaction, { where: { messageId } });
    return this.toDto(message, { viewerId, reactions });
  }

  private toPollDto(poll: MessagePollStored, viewerId?: string): MessagePollDto {
    const options = poll.options.map((o) => {
      const voters = poll.votes[o.id] ?? [];
      return {
        id: o.id,
        text: o.text,
        voteCount: voters.length,
        voted: viewerId ? voters.includes(viewerId) : false,
      };
    });
    return {
      question: poll.question,
      options,
      multi: poll.multi,
      totalVotes: options.reduce((s, o) => s + o.voteCount, 0),
      closed: Boolean(poll.closed),
    };
  }

  private toReactionsDto(
    reactions: Reaction[],
    viewerId?: string,
  ): MessageReactionDto[] {
    const map = new Map<string, { count: number; me: boolean }>();
    for (const r of reactions) {
      const cur = map.get(r.emoji) ?? { count: 0, me: false };
      cur.count += 1;
      if (viewerId && r.userId === viewerId) cur.me = true;
      map.set(r.emoji, cur);
    }
    return [...map.entries()].map(([emoji, v]) => ({
      emoji,
      count: v.count,
      me: v.me,
    }));
  }

  private toDto(
    message: Message,
    opts: {
      viewerId?: string;
      hideMode?: 'hidden' | null;
      reactions?: Reaction[];
    } = {},
  ): MessageDto {
    const hidden = opts.hideMode === 'hidden';
    return {
      id: message.id,
      channelId: message.channelId,
      author: toPublicUser(message.author),
      content: hidden ? '' : message.content,
      attachments: hidden ? undefined : (message.attachments ?? undefined),
      embeds: hidden ? undefined : message.embeds?.length ? message.embeds : undefined,
      reactions: hidden ? [] : this.toReactionsDto(opts.reactions ?? [], opts.viewerId),
      poll:
        hidden || !message.poll
          ? null
          : this.toPollDto(message.poll, opts.viewerId),
      viewerHide: hidden ? 'hidden' : null,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt?.toISOString() ?? null,
    };
  }
}
