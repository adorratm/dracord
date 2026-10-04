import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In, IsNull, LessThan, MoreThan, Not } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import { Channel } from '@/database/entities/channel.entity';
import { ChannelReadState } from '@/database/entities/channel-read-state.entity';
import { DMChannelMember } from '@/database/entities/dm-channel-member.entity';
import { Friendship } from '@/database/entities/friendship.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { Message } from '@/database/entities/message.entity';
import { MessageHide } from '@/database/entities/message-hide.entity';
import { MessageBookmark } from '@/database/entities/message-bookmark.entity';
import { Reaction } from '@/database/entities/reaction.entity';
import { User } from '@/database/entities/user.entity';
import type {
  MessageAttachment,
  MessageBookmarkDto,
  MessageDto,
  MessageEmbed,
  MessageForwardedFrom,
  MessagePage,
  MessagePollDto,
  MessageReactionDto,
  MessageReplyRef,
  MessageType,
  NotificationDto,
} from '@dracord/types';
import { toPublicUser } from '@/common/user.mapper';
import { GuildPermissions } from '@/common/permissions';
import { ChannelsService } from '@/channels/channels.service';
import { FriendshipStatus } from '@/database/enums';
import { GuildsService } from '@/guilds/guilds.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationsRealtimeService } from '@/notifications/notifications-realtime.service';
import { SearchIndexerService } from '@/search/search-indexer.service';
import { MusicCommandsService } from '@/music/music-commands.service';
import { DRACORD_BOT_USER_ID } from '@/bot/bot.constants';
import { LinkPreviewService } from './link-preview.service';
import { CustomSlashService } from './custom-slash.service';
import { MessagesRealtimeService } from './messages-realtime.service';

type MessagePollStored = {
  question: string;
  options: Array<{ id: string; text: string }>;
  votes: Record<string, string[]>;
  multi: boolean;
  closed?: boolean;
};
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
    private readonly musicCommands: MusicCommandsService,
    private readonly customSlash: CustomSlashService,
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
      threadRootId: IsNull(),
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

    // Thread içi mesaja around ile gelindiyse kök + yanıtları dön
    if (pivot.threadRootId) {
      return this.listThreadMessages(pivot.threadRootId, userId, limit);
    }

    const half = Math.max(1, Math.floor(limit / 2));
    const older = await this.em.find(Message, {
      where: {
        channelId,
        deletedAt: IsNull(),
        threadRootId: IsNull(),
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
        threadRootId: IsNull(),
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
          threadRootId: IsNull(),
          createdAt: LessThan(older[older.length - 1]?.createdAt ?? pivot.createdAt),
        },
      }));

    const raw = [...older.reverse(), pivot, ...newer];
    const items = await this.mapMessagesForViewer(raw, userId);
    return { items, hasMore: olderHasMore };
  }

  async listChannelThreads(
    channelId: string,
    userId: string,
    limit = 5,
  ): Promise<MessagePage> {
    await this.channels.getChannel(channelId, userId);
    const take = Math.min(Math.max(limit, 1), 50);
    const rows = await this.em
      .createQueryBuilder(Message, 'root')
      .innerJoin(
        Message,
        'reply',
        'reply.threadRootId = root.id AND reply.deletedAt IS NULL',
      )
      .where('root.channelId = :channelId', { channelId })
      .andWhere('root.deletedAt IS NULL')
      .andWhere('root.threadRootId IS NULL')
      .select('root.id', 'id')
      .addSelect('MAX(reply.createdAt)', 'lastReplyAt')
      .addSelect('COUNT(reply.id)', 'replyCount')
      .groupBy('root.id')
      .orderBy('"lastReplyAt"', 'DESC')
      .limit(take)
      .getRawMany<{ id: string; lastReplyAt: string; replyCount: string }>();

    if (!rows.length) return { items: [], hasMore: false };

    const order = rows.map((r) => r.id);
    const roots = await this.em.find(Message, {
      where: { id: In(order) },
      relations: { author: true },
    });
    const byId = new Map(roots.map((r) => [r.id, r]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean) as Message[];
    const items = await this.mapMessagesForViewer(ordered, userId);
    return { items, hasMore: rows.length >= take };
  }

  async listThreadMessages(
    rootMessageId: string,
    userId: string,
    limit = 100,
  ): Promise<MessagePage> {
    const root = await this.em.findOne(Message, {
      where: { id: rootMessageId, deletedAt: IsNull() },
      relations: { author: true },
    });
    if (!root) throw new NotFoundException('Thread bulunamadı');
    if (root.threadRootId) {
      throw new BadRequestException('Geçersiz thread kökü');
    }
    await this.channels.getChannel(root.channelId, userId);
    const take = Math.min(Math.max(limit, 1), 100);
    const replies = await this.em.find(Message, {
      where: {
        threadRootId: rootMessageId,
        deletedAt: IsNull(),
      },
      relations: { author: true },
      order: { createdAt: 'ASC' },
      take,
    });
    const items = await this.mapMessagesForViewer([root, ...replies], userId);
    return { items, hasMore: false };
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
    const bookmarks = await this.em.find(MessageBookmark, {
      where: { userId: viewerId, messageId: In(ids) },
    });
    const bookmarkSet = new Set(bookmarks.map((b) => b.messageId));
    const reactions = await this.em.find(Reaction, {
      where: { messageId: In(ids) },
      relations: { user: true },
    });
    const reactionByMsg = new Map<string, Reaction[]>();
    for (const r of reactions) {
      const list = reactionByMsg.get(r.messageId) ?? [];
      list.push(r);
      reactionByMsg.set(r.messageId, list);
    }

    const replyIds = [
      ...new Set(messages.map((m) => m.replyToId).filter((id): id is string => Boolean(id))),
    ];
    const replyMap = new Map<string, MessageReplyRef>();
    if (replyIds.length) {
      const parents = await this.em.find(Message, {
        where: { id: In(replyIds) },
        relations: { author: true },
      });
      for (const p of parents) {
        replyMap.set(p.id, {
          id: p.id,
          authorId: p.authorId,
          authorName: p.author?.displayName ?? 'Kullanıcı',
          contentPreview: (p.content || '').slice(0, 120),
        });
      }
    }

    const pollVoters = await this.loadPollVoterUsers(messages.map((m) => m.poll));

    const rootIds = messages.filter((m) => !m.threadRootId).map((m) => m.id);
    const replyCountMap = new Map<string, number>();
    if (rootIds.length) {
      const rows = await this.em
        .createQueryBuilder(Message, 'm')
        .select('m.threadRootId', 'rootId')
        .addSelect('COUNT(*)', 'cnt')
        .where('m.threadRootId IN (:...rootIds)', { rootIds })
        .andWhere('m.deletedAt IS NULL')
        .groupBy('m.threadRootId')
        .getRawMany<{ rootId: string; cnt: string }>();
      for (const row of rows) {
        replyCountMap.set(row.rootId, Number(row.cnt) || 0);
      }
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
          bookmarked: bookmarkSet.has(m.id),
          reactions: reactionByMsg.get(m.id) ?? [],
          replyTo: m.replyToId ? replyMap.get(m.replyToId) ?? null : null,
          pollVoters,
          threadReplyCount: m.threadRootId ? undefined : replyCountMap.get(m.id) ?? 0,
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
    opts: {
      replyToId?: string;
      threadRootId?: string;
      type?: MessageType;
      forwardedFrom?: MessageForwardedFrom | null;
    } = {},
  ): Promise<{ message: MessageDto; notifications: NotificationDto[] }> {
    await this.channels.getChannel(channelId, userId);
    const channelRow = await this.em.findOne(Channel, { where: { id: channelId } });
    if (channelRow?.guildId) {
      await this.guilds.assertNotTimedOut(channelRow.guildId, userId);
      const canSend = await this.channels.memberCanInChannel(
        channelRow,
        userId,
        'SEND_MESSAGES',
      );
      if (!canSend) {
        throw new ForbiddenException('Bu kanala mesaj gönderme iznin yok');
      }
    }
    const trimmed = content.trim();
    const msgType: MessageType = opts.type === 'heading' ? 'heading' : 'default';
    let poll: MessagePollStored | null = null;
    if (pollInput && msgType === 'default') {
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
    if (msgType === 'heading') {
      if (!trimmed) throw new BadRequestException('Başlık boş olamaz');
      if (trimmed.length > 200) throw new BadRequestException('Başlık çok uzun');
    }
    if (
      !trimmed &&
      (!attachments || attachments.length === 0) &&
      !poll &&
      msgType === 'default' &&
      !opts.forwardedFrom
    ) {
      throw new BadRequestException('Mesaj boş olamaz');
    }

    let replyToId: string | null = null;
    let replyRef: MessageReplyRef | null = null;
    let threadRootId: string | null = null;
    if (opts.threadRootId) {
      const root = await this.em.findOne(Message, {
        where: { id: opts.threadRootId, channelId, deletedAt: IsNull() },
      });
      if (!root || root.threadRootId) {
        throw new BadRequestException('Geçersiz thread kökü');
      }
      threadRootId = root.id;
    }
    if (opts.replyToId) {
      const parent = await this.em.findOne(Message, {
        where: { id: opts.replyToId, channelId, deletedAt: IsNull() },
        relations: { author: true },
      });
      if (!parent) throw new BadRequestException('Yanıtlanan mesaj bulunamadı');
      replyToId = parent.id;
      replyRef = {
        id: parent.id,
        authorId: parent.authorId,
        authorName: parent.author?.displayName ?? 'Kullanıcı',
        contentPreview: (parent.content || '').slice(0, 120),
      };
      // Açık threadRoot yoksa yanıttan thread'e bağla
      if (!threadRootId && parent.threadRootId) {
        threadRootId = parent.threadRootId;
      }
    }

    const embeds =
      msgType === 'default' && trimmed && !poll && !/^sticker:\S+$/u.test(trimmed)
        ? await this.linkPreview.buildEmbeds(trimmed)
        : [];
    // Attachment URL’leri content’te tekrarlanıyorsa embed’i atla (yalnızca görsel mesaj)
    const attachmentUrls = new Set((attachments ?? []).map((a) => a.url));
    const contentUrls = trimmed ? this.linkPreview.extractUrls(trimmed) : [];
    const onlyAttachmentUrls =
      attachmentUrls.size > 0 &&
      contentUrls.length > 0 &&
      contentUrls.every((u) => attachmentUrls.has(u));
    const finalEmbeds = onlyAttachmentUrls ? [] : embeds;
    const saved = await this.em.save(
      Message,
      this.em.create(Message, {
        channelId,
        authorId: userId,
        content: trimmed || (poll || opts.forwardedFrom ? ' ' : ' '),
        type: msgType,
        replyToId,
        threadRootId,
        pinnedAt: null,
        pinnedById: null,
        forwardedFrom: opts.forwardedFrom ?? null,
        attachments: attachments?.length ? attachments : null,
        embeds: finalEmbeds.length ? finalEmbeds : null,
        poll,
      }),
    );
    const message = await this.em.findOneOrFail(Message, {
      where: { id: saved.id },
      relations: { author: true },
    });
    const dto = await this.toDtoResolved(message, {
      viewerId: userId,
      reactions: [],
      replyTo: replyRef,
    });
    void this.indexer
      .indexMessage(dto, {
        guildId: channelRow?.guildId ?? null,
        dmChannelId: channelRow?.dmChannelId ?? null,
      })
      .catch(() => undefined);

    const notifications =
      msgType === 'heading'
        ? []
        : await this.createMessageNotifications(dto, channelRow, userId);
    this.realtime.emitCreate(channelId, dto);

    if (threadRootId) {
      const replyCount = await this.em.count(Message, {
        where: { threadRootId, deletedAt: IsNull() },
      });
      const rootEntity = await this.em.findOne(Message, {
        where: { id: threadRootId, deletedAt: IsNull() },
        relations: { author: true },
      });
      if (rootEntity) {
        const rootReactions = await this.em.find(Reaction, {
          where: { messageId: threadRootId },
          relations: { user: true },
        });
        const rootDto = await this.toDtoResolved(rootEntity, {
          viewerId: userId,
          reactions: rootReactions,
          threadReplyCount: replyCount,
        });
        this.realtime.emitUpdate(channelId, rootDto);
      }
    }

    if (
      userId !== DRACORD_BOT_USER_ID &&
      msgType === 'default' &&
      trimmed.startsWith('/') &&
      !attachments?.length &&
      !poll
    ) {
      void (async () => {
        const music = await this.musicCommands.tryHandle(userId, channelId, trimmed);
        if (!music) await this.customSlash.tryHandle(userId, channelId, trimmed);
      })().catch(() => undefined);
    }

    return { message: dto, notifications };
  }

  async forwardMessage(
    messageId: string,
    userId: string,
    targetChannelId: string,
    note?: string,
  ): Promise<MessageDto> {
    const source = await this.em.findOne(Message, {
      where: { id: messageId, deletedAt: IsNull() },
      relations: { author: true },
    });
    if (!source) throw new NotFoundException('Mesaj bulunamadı');
    await this.channels.getChannel(source.channelId, userId);
    await this.channels.getChannel(targetChannelId, userId);

    const snapshot: MessageForwardedFrom = {
      messageId: source.id,
      channelId: source.channelId,
      authorId: source.authorId,
      authorName: source.author?.displayName ?? 'Kullanıcı',
      contentPreview: (source.content || '').slice(0, 200),
      createdAt: source.createdAt.toISOString(),
    };
    const { message } = await this.createMessage(
      targetChannelId,
      userId,
      note?.trim() || '',
      source.attachments ?? undefined,
      undefined,
      { forwardedFrom: snapshot },
    );
    return message;
  }

  async pinMessage(messageId: string, userId: string): Promise<MessageDto> {
    const message = await this.em.findOne(Message, {
      where: { id: messageId, deletedAt: IsNull() },
      relations: { author: true },
    });
    if (!message) throw new NotFoundException('Mesaj bulunamadı');
    await this.channels.getChannel(message.channelId, userId);
    await this.requireManageMessages(message.channelId, userId);
    message.pinnedAt = new Date();
    message.pinnedById = userId;
    await this.em.save(Message, message);
    const reactions = await this.em.find(Reaction, { where: { messageId }, relations: { user: true } });
    const dto = await this.toDtoWithReply(message, userId, reactions);
    this.realtime.emitUpdate(message.channelId, dto);
    return dto;
  }

  async unpinMessage(messageId: string, userId: string): Promise<MessageDto> {
    const message = await this.em.findOne(Message, {
      where: { id: messageId, deletedAt: IsNull() },
      relations: { author: true },
    });
    if (!message) throw new NotFoundException('Mesaj bulunamadı');
    await this.channels.getChannel(message.channelId, userId);
    await this.requireManageMessages(message.channelId, userId);
    message.pinnedAt = null;
    message.pinnedById = null;
    await this.em.save(Message, message);
    const reactions = await this.em.find(Reaction, { where: { messageId }, relations: { user: true } });
    const dto = await this.toDtoWithReply(message, userId, reactions);
    this.realtime.emitUpdate(message.channelId, dto);
    return dto;
  }

  async listPinned(channelId: string, userId: string): Promise<MessageDto[]> {
    await this.channels.getChannel(channelId, userId);
    const messages = await this.em.find(Message, {
      where: { channelId, deletedAt: IsNull(), pinnedAt: Not(IsNull()) },
      relations: { author: true },
      order: { pinnedAt: 'DESC' },
      take: 50,
    });
    return this.mapMessagesForViewer(messages, userId);
  }

  async markChannelRead(
    channelId: string,
    userId: string,
    opts: { messageId?: string; unreadFrom?: boolean } = {},
  ): Promise<{ lastReadMessageId: string | null }> {
    await this.channels.getChannel(channelId, userId);
    let lastReadMessageId: string | null = null;

    if (opts.messageId && opts.unreadFrom) {
      const target = await this.em.findOne(Message, {
        where: { id: opts.messageId, channelId, deletedAt: IsNull() },
      });
      if (!target) throw new NotFoundException('Mesaj bulunamadı');
      const prev = await this.em.findOne(Message, {
        where: {
          channelId,
          deletedAt: IsNull(),
          createdAt: LessThan(target.createdAt),
        },
        order: { createdAt: 'DESC' },
      });
      lastReadMessageId = prev?.id ?? null;
    } else if (opts.messageId) {
      const target = await this.em.findOne(Message, {
        where: { id: opts.messageId, channelId, deletedAt: IsNull() },
      });
      if (!target) throw new NotFoundException('Mesaj bulunamadı');
      lastReadMessageId = target.id;
    } else {
      const latest = await this.em.findOne(Message, {
        where: { channelId, deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });
      lastReadMessageId = latest?.id ?? null;
    }

    let state = await this.em.findOne(ChannelReadState, {
      where: { userId, channelId },
    });
    if (!state) {
      state = this.em.create(ChannelReadState, { userId, channelId });
    }
    state.lastReadMessageId = lastReadMessageId;
    state.lastReadAt = new Date();
    await this.em.save(ChannelReadState, state);
    return { lastReadMessageId };
  }

  async getReadState(
    channelId: string,
    userId: string,
  ): Promise<{ lastReadMessageId: string | null; unread: boolean }> {
    await this.channels.getChannel(channelId, userId);
    const state = await this.em.findOne(ChannelReadState, {
      where: { userId, channelId },
    });
    const latest = await this.em.findOne(Message, {
      where: { channelId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const lastReadMessageId = state?.lastReadMessageId ?? null;
    const unread = Boolean(
      latest && lastReadMessageId && latest.id !== lastReadMessageId,
    ) || Boolean(latest && !lastReadMessageId);
    return { lastReadMessageId, unread: latest ? unread : false };
  }

  private async requireManageMessages(channelId: string, userId: string) {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel?.guildId) return; // DM: herkes pinleyebilir
    const ok = await this.guilds.memberHasPermission(
      channel.guildId,
      userId,
      GuildPermissions.MANAGE_MESSAGES,
    );
    if (ok) return;
    const perms = await this.guilds.listMyPermissions(channel.guildId, userId);
    if (perms.owner || perms.permissions.includes('ADMINISTRATOR')) return;
    throw new ForbiddenException('Mesaj sabitleme yetkin yok');
  }

  private async toDtoWithReply(
    message: Message,
    viewerId: string,
    reactions: Reaction[],
  ): Promise<MessageDto> {
    let replyTo: MessageReplyRef | null = null;
    if (message.replyToId) {
      const parent = await this.em.findOne(Message, {
        where: { id: message.replyToId },
        relations: { author: true },
      });
      if (parent) {
        replyTo = {
          id: parent.id,
          authorId: parent.authorId,
          authorName: parent.author?.displayName ?? 'Kullanıcı',
          contentPreview: (parent.content || '').slice(0, 120),
        };
      }
    }
    return this.toDtoResolved(message, { viewerId, reactions, replyTo });
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
    message.embeds =
      trimmed && !message.poll && !/^sticker:\S+$/u.test(trimmed)
        ? await this.linkPreview.buildEmbeds(trimmed)
        : null;
    await this.em.save(Message, message);
    const reactions = await this.em.find(Reaction, { where: { messageId }, relations: { user: true } });
    const dto = await this.toDtoResolved(message, { viewerId: userId, reactions });
    void this.indexer.indexMessage(dto).catch(() => undefined);
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
    void this.indexer.deleteMessage(message.id).catch(() => undefined);
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
    const reactions = await this.em.find(Reaction, {
      where: { messageId },
      relations: { user: true },
    });
    const dto = await this.toDtoResolved(message, { viewerId: userId, reactions });
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
    const reactions = await this.em.find(Reaction, { where: { messageId }, relations: { user: true } });
    const dto = await this.toDtoResolved(message, { viewerId: userId, reactions });
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

  async bookmarkMessage(messageId: string, userId: string): Promise<MessageDto> {
    const message = await this.em.findOne(Message, {
      where: { id: messageId },
      relations: { author: true },
    });
    if (!message || message.deletedAt) throw new NotFoundException('Mesaj bulunamadı');
    await this.channels.getChannel(message.channelId, userId);
    const existing = await this.em.findOne(MessageBookmark, {
      where: { userId, messageId },
    });
    if (!existing) {
      await this.em.save(
        MessageBookmark,
        this.em.create(MessageBookmark, { userId, messageId }),
      );
    }
    const reactions = await this.em.find(Reaction, {
      where: { messageId },
      relations: { user: true },
    });
    return this.toDtoResolved(message, {
      viewerId: userId,
      bookmarked: true,
      reactions,
    });
  }

  async unbookmarkMessage(messageId: string, userId: string): Promise<MessageDto> {
    const message = await this.em.findOne(Message, {
      where: { id: messageId },
      relations: { author: true },
    });
    if (!message || message.deletedAt) throw new NotFoundException('Mesaj bulunamadı');
    const row = await this.em.findOne(MessageBookmark, {
      where: { userId, messageId },
    });
    if (row) await this.em.remove(MessageBookmark, row);
    const reactions = await this.em.find(Reaction, {
      where: { messageId },
      relations: { user: true },
    });
    return this.toDtoResolved(message, {
      viewerId: userId,
      bookmarked: false,
      reactions,
    });
  }

  async listBookmarks(userId: string, limit = 50): Promise<MessageBookmarkDto[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.em.find(MessageBookmark, {
      where: { userId },
      order: { createdAt: 'DESC' },
      take,
    });
    if (!rows.length) return [];
    const messages = await this.em.find(Message, {
      where: { id: In(rows.map((r) => r.messageId)), deletedAt: IsNull() },
      relations: { author: true },
    });
    const msgById = new Map(messages.map((m) => [m.id, m]));
    const channelIds = [...new Set(messages.map((m) => m.channelId))];
    const channels = channelIds.length
      ? await this.em.find(Channel, { where: { id: In(channelIds) } })
      : [];
    const chById = new Map(channels.map((c) => [c.id, c]));
    const dtos = await this.mapMessagesForViewer(messages, userId);
    const dtoById = new Map(dtos.map((d) => [d.id, d]));

    const out: MessageBookmarkDto[] = [];
    for (const row of rows) {
      const msg = msgById.get(row.messageId);
      const dto = dtoById.get(row.messageId);
      if (!msg || !dto) continue;
      const ch = chById.get(msg.channelId);
      out.push({
        id: row.id,
        messageId: row.messageId,
        channelId: msg.channelId,
        channelName: ch?.name ?? null,
        guildId: ch?.guildId ?? null,
        createdAt: row.createdAt.toISOString(),
        message: { ...dto, bookmarked: true },
      });
    }
    return out;
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
          body: channel?.name
            ? `#${channel.name}: ${snippet}`
            : snippet,
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

    // Düz DM mesajı bildirimi (self-DM hariç; mention varsa tekrar etme)
    if (channel?.dmChannelId) {
      const members = await this.em.find(DMChannelMember, {
        where: { dmChannelId: channel.dmChannelId },
      });
      for (const m of members) {
        if (m.userId === authorId) continue;
        if (mentionedIds.has(m.userId)) continue;
        inputs.push({
          userId: m.userId,
          type: 'DM',
          title: `${authorName} sana mesaj gönderdi`,
          body: snippet,
          link: linkBase,
          actorId: authorId,
          guildId: null,
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
    const reactions = await this.em.find(Reaction, { where: { messageId }, relations: { user: true } });
    return this.toDtoResolved(message, { viewerId, reactions });
  }

  private async loadPollVoterUsers(
    polls: Array<MessagePollStored | null | undefined>,
  ): Promise<Map<string, User>> {
    const ids = new Set<string>();
    for (const poll of polls) {
      if (!poll?.votes) continue;
      for (const list of Object.values(poll.votes)) {
        for (const id of list) ids.add(id);
      }
    }
    if (!ids.size) return new Map();
    const users = await this.em.find(User, { where: { id: In([...ids]) } });
    return new Map(users.map((u) => [u.id, u]));
  }

  private toPollDto(
    poll: MessagePollStored,
    viewerId?: string,
    voterUsers?: Map<string, User>,
  ): MessagePollDto {
    const options = poll.options.map((o) => {
      const voterIds = poll.votes[o.id] ?? [];
      const voters = voterIds
        .slice(-3)
        .reverse()
        .map((id) => {
          const u = voterUsers?.get(id);
          return {
            id,
            displayName: u?.displayName ?? 'Kullanıcı',
            avatarUrl: u?.avatarUrl ?? null,
          };
        });
      return {
        id: o.id,
        text: o.text,
        voteCount: voterIds.length,
        voted: viewerId ? voterIds.includes(viewerId) : false,
        voters,
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
    const map = new Map<
      string,
      {
        count: number;
        me: boolean;
        users: Array<{ id: string; displayName: string; avatarUrl?: string | null }>;
      }
    >();
    for (const r of reactions) {
      const cur = map.get(r.emoji) ?? { count: 0, me: false, users: [] };
      cur.count += 1;
      if (viewerId && r.userId === viewerId) cur.me = true;
      const u = r.user;
      cur.users.push({
        id: r.userId,
        displayName: u?.displayName ?? 'Kullanıcı',
        avatarUrl: u?.avatarUrl ?? null,
      });
      map.set(r.emoji, cur);
    }
    return [...map.entries()].map(([emoji, v]) => ({
      emoji,
      count: v.count,
      me: v.me,
      users: v.users.slice(0, 24),
    }));
  }

  private toDto(
    message: Message,
    opts: {
      viewerId?: string;
      hideMode?: 'hidden' | null;
      bookmarked?: boolean;
      reactions?: Reaction[];
      replyTo?: MessageReplyRef | null;
      pollVoters?: Map<string, User>;
      threadReplyCount?: number;
    } = {},
  ): MessageDto {
    const hidden = opts.hideMode === 'hidden';
    return {
      id: message.id,
      channelId: message.channelId,
      author: toPublicUser(message.author),
      content: hidden ? '' : message.content,
      type: message.type ?? 'default',
      replyTo: hidden ? null : (opts.replyTo ?? null),
      pinnedAt: message.pinnedAt?.toISOString() ?? null,
      threadRootId: message.threadRootId ?? null,
      threadReplyCount:
        message.threadRootId != null
          ? undefined
          : (opts.threadReplyCount ?? 0),
      forwardedFrom: hidden ? null : (message.forwardedFrom ?? null),
      attachments: hidden ? undefined : (message.attachments ?? undefined),
      embeds: hidden ? undefined : message.embeds?.length ? message.embeds : undefined,
      reactions: hidden ? [] : this.toReactionsDto(opts.reactions ?? [], opts.viewerId),
      poll:
        hidden || !message.poll
          ? null
          : this.toPollDto(message.poll, opts.viewerId, opts.pollVoters),
      viewerHide: hidden ? 'hidden' : null,
      bookmarked: Boolean(opts.bookmarked),
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt?.toISOString() ?? null,
    };
  }

  private async toDtoResolved(
    message: Message,
    opts: {
      viewerId?: string;
      hideMode?: 'hidden' | null;
      bookmarked?: boolean;
      reactions?: Reaction[];
      replyTo?: MessageReplyRef | null;
      threadReplyCount?: number;
    } = {},
  ): Promise<MessageDto> {
    const pollVoters = await this.loadPollVoterUsers([message.poll]);
    return this.toDto(message, { ...opts, pollVoters });
  }
}

