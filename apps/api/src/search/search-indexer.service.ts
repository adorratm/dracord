import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { MessageDto } from '@dracord/types';
import { EntityManager, IsNull } from 'typeorm';
import { Channel } from '@/database/entities/channel.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { Message } from '@/database/entities/message.entity';
import { User } from '@/database/entities/user.entity';
import {
  ElasticsearchService,
  IDX_CHANNELS,
  IDX_GUILDS,
  IDX_MESSAGES,
  IDX_USERS,
} from './elasticsearch.service';

@Injectable()
export class SearchIndexerService implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexerService.name);

  constructor(
    private readonly es: ElasticsearchService,
    private readonly em: EntityManager,
  ) {}

  async onModuleInit() {
    setTimeout(() => {
      void this.maybeBootstrapReindex();
    }, 2500);
  }

  private async maybeBootstrapReindex() {
    if (!this.es.client || !this.es.isReady()) return;
    try {
      const count = await this.es.messageIndexCount();
      const dbCount = await this.em.count(Message, { where: { deletedAt: IsNull() } });
      // ES boşsa veya DB'de daha fazla mesaj varsa (ör. ES downtime sırasında kaçanlar) senkronize et
      if (count < 0) return;
      if (dbCount > count) {
        this.logger.log(
          `ES mesaj indeksi geride (ES=${count}, DB=${dbCount}) — reindex başlıyor`,
        );
        const result = await this.reindexAll();
        this.logger.log(`Reindex tamam: ${JSON.stringify(result)}`);
      }
    } catch (err) {
      this.logger.warn(`Bootstrap reindex atlandı: ${(err as Error).message}`);
    }
  }

  async indexMessage(
    message: MessageDto,
    meta?: { guildId: string | null; dmChannelId: string | null },
    opts?: { refresh?: boolean | 'wait_for' },
  ) {
    if (!this.es.client || !this.es.isReady()) return;
    let guildId = meta?.guildId ?? null;
    let dmChannelId = meta?.dmChannelId ?? null;
    if (!meta) {
      const ch = await this.em.findOne(Channel, { where: { id: message.channelId } });
      guildId = ch?.guildId ?? null;
      dmChannelId = ch?.dmChannelId ?? null;
    }
    try {
      await this.es.client.index({
        index: IDX_MESSAGES,
        id: message.id,
        document: {
          channelId: message.channelId,
          guildId,
          dmChannelId,
          authorId: message.author.id,
          authorName: message.author.displayName,
          content: message.content,
          attachmentNames: (message.attachments ?? []).map((a) => a.filename).join(' '),
          threadRootId: message.threadRootId ?? null,
          createdAt: message.createdAt,
        },
        refresh: opts?.refresh ?? 'wait_for',
      });
    } catch (err) {
      this.logger.warn(`Mesaj index hatası ${message.id}: ${(err as Error).message}`);
    }
  }

  async deleteMessage(messageId: string) {
    if (!this.es.client || !this.es.isReady()) return;
    try {
      await this.es.client.delete({ index: IDX_MESSAGES, id: messageId, refresh: false });
    } catch {
      // ignore missing
    }
  }

  async deleteUser(userId: string) {
    if (!this.es.client || !this.es.isReady()) return;
    try {
      await this.es.client.delete({ index: IDX_USERS, id: userId, refresh: false });
    } catch {
      // ignore missing
    }
  }

  async indexGuild(guild: {
    id: string;
    name: string;
    iconUrl: string | null;
    discoverable?: boolean;
  }) {
    if (!this.es.client || !this.es.isReady()) return;
    const members = await this.em.find(GuildMember, {
      where: { guildId: guild.id },
      select: { userId: true },
    });
    try {
      await this.es.client.index({
        index: IDX_GUILDS,
        id: guild.id,
        document: {
          name: guild.name,
          iconUrl: guild.iconUrl,
          discoverable: Boolean(guild.discoverable),
          memberIds: members.map((m) => m.userId),
        },
        refresh: false,
      });
    } catch (err) {
      this.logger.warn(`Guild index hatası ${guild.id}: ${(err as Error).message}`);
    }
  }

  async indexChannel(channel: {
    id: string;
    guildId: string | null;
    dmChannelId?: string | null;
    name: string;
    type: string;
  }) {
    if (!this.es.client || !this.es.isReady()) return;
    try {
      await this.es.client.index({
        index: IDX_CHANNELS,
        id: channel.id,
        document: {
          guildId: channel.guildId,
          dmChannelId: channel.dmChannelId ?? null,
          name: channel.name,
          channelType: channel.type,
        },
        refresh: false,
      });
    } catch (err) {
      this.logger.warn(`Kanal index hatası ${channel.id}: ${(err as Error).message}`);
    }
  }

  async indexUser(user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  }) {
    if (!this.es.client || !this.es.isReady()) return;
    try {
      await this.es.client.index({
        index: IDX_USERS,
        id: user.id,
        document: {
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        refresh: false,
      });
    } catch (err) {
      this.logger.warn(`User index hatası ${user.id}: ${(err as Error).message}`);
    }
  }

  async reindexAll() {
    if (!this.es.client) throw new Error('Elasticsearch yapılandırılmamış');
    if (!this.es.isReady()) throw new Error('Elasticsearch hazır değil');

    const users = await this.em.find(User);
    for (const u of users) {
      await this.indexUser(u);
    }

    const guilds = await this.em.find(Guild);
    for (const g of guilds) {
      await this.indexGuild(g);
    }

    const channels = await this.em.find(Channel);
    for (const c of channels) {
      await this.indexChannel(c);
    }

    const messages = await this.em.find(Message, {
      where: { deletedAt: IsNull() },
      relations: { author: true },
      take: 50_000,
    });
    for (const m of messages) {
      await this.indexMessage(
        {
          id: m.id,
          channelId: m.channelId,
          author: {
            id: m.author.id,
            username: m.author.username,
            displayName: m.author.displayName,
            avatarUrl: m.author.avatarUrl,
            status: m.author.status as never,
          },
          content: m.content,
          attachments: m.attachments ?? undefined,
          threadRootId: m.threadRootId ?? null,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt?.toISOString() ?? null,
        },
        undefined,
        { refresh: false },
      );
    }

    await this.es.client.indices.refresh({
      index: [IDX_MESSAGES, IDX_GUILDS, IDX_CHANNELS, IDX_USERS],
    });
    return {
      users: users.length,
      guilds: guilds.length,
      channels: channels.length,
      messages: messages.length,
    };
  }
}
