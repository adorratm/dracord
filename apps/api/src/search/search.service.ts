import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SearchHit, SearchResponse } from '@dracord/types';
import { EntityManager } from 'typeorm';
import { Channel } from '@/database/entities/channel.entity';
import { DMChannelMember } from '@/database/entities/dm-channel-member.entity';
import { Friendship } from '@/database/entities/friendship.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { User } from '@/database/entities/user.entity';
import { FriendshipStatus } from '@/database/enums';
import {
  ElasticsearchService,
  IDX_CHANNELS,
  IDX_GUILDS,
  IDX_MESSAGES,
  IDX_USERS,
} from './elasticsearch.service';

const TYPE_ALIASES: Record<string, string> = {
  guild: 'guilds',
  guilds: 'guilds',
  channel: 'channels',
  channels: 'channels',
  user: 'users',
  users: 'users',
  message: 'messages',
  messages: 'messages',
};

function normalizeSearchTypes(raw?: string[]): Set<string> {
  const list = (raw?.length ? raw : ['guilds', 'channels', 'users', 'messages']).map((t) =>
    TYPE_ALIASES[t.toLowerCase()] ?? t.toLowerCase(),
  );
  return new Set(list);
}

@Injectable()
export class SearchService {
  constructor(
    private readonly es: ElasticsearchService,
    private readonly em: EntityManager,
  ) {}

  async search(
    userId: string,
    q: string,
    opts: {
      types?: string[];
      guildId?: string;
      channelId?: string;
      limit?: number;
    } = {},
  ): Promise<SearchResponse> {
    const query = q.trim();
    if (query.length < 1) {
      return { query, hits: [] };
    }
    const types = normalizeSearchTypes(opts.types);
    const wantsMessages = types.has('messages');
    const wantsNav =
      types.has('guilds') || types.has('channels') || types.has('users');

    // ES yoksa: nav DB yedek; yalnızca mesaj isteniyorsa 503
    if (!this.es.client || !this.es.isReady()) {
      if (wantsMessages && !wantsNav) {
        throw new ServiceUnavailableException('Mesaj araması şu an kullanılamıyor');
      }
      if (wantsMessages && wantsNav) {
        // Mesajları atla, nav sonuçlarını dön
        const navTypes = [...types].filter((t) => t !== 'messages');
        return this.dbFallbackSearch(userId, query, {
          ...opts,
          types: navTypes,
        });
      }
      return this.dbFallbackSearch(userId, query, opts);
    }

    try {
      return await this.runSearch(userId, query, opts);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      // ES anlık hata → nav için DB yedek
      if (wantsNav && !wantsMessages) {
        return this.dbFallbackSearch(userId, query, opts);
      }
      throw new ServiceUnavailableException(
        `Arama başarısız: ${(err as Error).message?.slice(0, 120) || 'bilinmeyen hata'}`,
      );
    }
  }

  /** Platform admin: üyelik filtresi olmadan tüm indeksler */
  async searchPlatformAdmin(
    q: string,
    opts: {
      types?: string[];
      guildId?: string;
      channelId?: string;
      limit?: number;
    } = {},
  ): Promise<SearchResponse> {
    const query = q.trim();
    if (query.length < 1) {
      return { query, hits: [] };
    }
    if (!this.es.client || !this.es.isReady()) {
      throw new ServiceUnavailableException('Arama servisi kullanılamıyor');
    }
    try {
      return await this.runSearch('__platform_admin__', query, {
        ...opts,
        platformAdmin: true,
      });
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(
        `Arama başarısız: ${(err as Error).message?.slice(0, 120) || 'bilinmeyen hata'}`,
      );
    }
  }

  /** Elasticsearch kapalıyken sunucu / kanal / kullanıcı (üyelik + ILIKE) */
  private async dbFallbackSearch(
    userId: string,
    query: string,
    opts: {
      types?: string[];
      guildId?: string;
      channelId?: string;
      limit?: number;
    },
  ): Promise<SearchResponse> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const types = normalizeSearchTypes(opts.types);
    const like = `%${query.replace(/[%_]/g, '')}%`;
    const hits: SearchHit[] = [];

    const memberships = await this.em.find(GuildMember, {
      where: { userId },
      select: { guildId: true },
    });
    const memberGuildIds = memberships.map((m) => m.guildId);

    if (types.has('guilds') && memberGuildIds.length) {
      const guildRows = await this.em
        .createQueryBuilder(Guild, 'g')
        .where('g.id IN (:...ids)', { ids: memberGuildIds })
        .andWhere('g.name ILIKE :like', { like })
        .take(limit)
        .getMany();
      for (const g of guildRows) {
        hits.push({
          type: 'guild',
          id: g.id,
          name: g.name,
          iconUrl: g.iconUrl,
          discoverable: g.discoverable,
        });
      }
    }

    if (types.has('channels') && memberGuildIds.length) {
      const chQb = this.em
        .createQueryBuilder(Channel, 'c')
        .where('c.guildId IN (:...ids)', { ids: memberGuildIds })
        .andWhere('c.name ILIKE :like', { like })
        .take(limit);
      if (opts.guildId) {
        chQb.andWhere('c.guildId = :guildId', { guildId: opts.guildId });
      }
      const channels = await chQb.getMany();
      for (const c of channels) {
        hits.push({
          type: 'channel',
          id: c.id,
          guildId: c.guildId,
          name: c.name,
          channelType: c.type,
        });
      }
    }

    if (types.has('users')) {
      const friendships = await this.em.find(Friendship, {
        where: [
          { userId, status: FriendshipStatus.ACCEPTED },
          { friendId: userId, status: FriendshipStatus.ACCEPTED },
        ],
      });
      const friendIds = friendships.map((f) =>
        f.userId === userId ? f.friendId : f.userId,
      );
      let coMemberIds: string[] = [];
      if (memberGuildIds.length) {
        const co = await this.em
          .createQueryBuilder(GuildMember, 'gm')
          .select('DISTINCT gm.userId', 'userId')
          .where('gm.guildId IN (:...guildIds)', { guildIds: memberGuildIds })
          .andWhere('gm.userId != :userId', { userId })
          .take(400)
          .getRawMany<{ userId: string }>();
        coMemberIds = co.map((c) => c.userId);
      }
      const visible = [...new Set([...friendIds, ...coMemberIds])];
      if (visible.length) {
        const users = await this.em
          .createQueryBuilder(User, 'u')
          .where('u.id IN (:...ids)', { ids: visible })
          .andWhere(
            '(u.username ILIKE :like OR u.displayName ILIKE :like)',
            { like },
          )
          .take(limit)
          .getMany();
        for (const u of users) {
          hits.push({
            type: 'user',
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
          });
        }
      }
    }

    return { query, hits: hits.slice(0, limit) };
  }

  private async runSearch(
    userId: string,
    query: string,
    opts: {
      types?: string[];
      guildId?: string;
      channelId?: string;
      limit?: number;
      platformAdmin?: boolean;
    },
  ): Promise<SearchResponse> {
    const client = this.es.client;
    if (!client || !this.es.isReady()) {
      throw new ServiceUnavailableException('Arama servisi kullanılamıyor');
    }
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const types = normalizeSearchTypes(opts.types);
    const isAdmin = Boolean(opts.platformAdmin);

    const memberships = isAdmin
      ? []
      : await this.em.find(GuildMember, {
          where: { userId },
          select: { guildId: true },
        });
    const memberGuildIds = memberships.map((m) => m.guildId);

    const dmMemberships = isAdmin
      ? []
      : await this.em.find(DMChannelMember, {
          where: { userId },
          select: { dmChannelId: true },
        });
    const dmIds = dmMemberships.map((m) => m.dmChannelId);

    const friendships = isAdmin
      ? []
      : await this.em.find(Friendship, {
          where: [
            { userId, status: FriendshipStatus.ACCEPTED },
            { friendId: userId, status: FriendshipStatus.ACCEPTED },
          ],
        });
    const friendIds = friendships.map((f) => (f.userId === userId ? f.friendId : f.userId));

    // Users who share a guild — prefix aramada tüm popülasyonu çekme
    let coMemberIds: string[] = [];
    if (!isAdmin && memberGuildIds.length) {
      const prefix = query.trim().toLocaleLowerCase('tr-TR').slice(0, 32);
      const qb = this.em
        .createQueryBuilder(GuildMember, 'gm')
        .innerJoin(User, 'u', 'u.id = gm.userId')
        .select('DISTINCT gm.userId', 'userId')
        .where('gm.guildId IN (:...guildIds)', { guildIds: memberGuildIds })
        .andWhere('gm.userId != :userId', { userId })
        .take(500);
      if (prefix.length >= 1) {
        qb.andWhere(
          '(LOWER(u.username) LIKE :p OR LOWER(u.displayName) LIKE :p)',
          { p: `${prefix.replace(/[%_]/g, '')}%` },
        );
      }
      const co = await qb.getRawMany<{ userId: string }>();
      coMemberIds = co.map((c) => c.userId);
    }
    const visibleUserIds = [...new Set([...friendIds, ...coMemberIds])];

    const hits: SearchHit[] = [];

    if (types.has('guilds')) {
      const nameMatch = {
        bool: {
          should: [
            {
              multi_match: {
                query,
                fields: ['name'],
                fuzziness: 'AUTO',
                operator: 'or' as const,
              },
            },
            { match_phrase_prefix: { name: { query, max_expansions: 50 } } },
            {
              wildcard: {
                'name.keyword': {
                  value: `*${query.toLowerCase().replace(/[*?\\]/g, '')}*`,
                  case_insensitive: true,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      };
      const res = await client.search({
        index: IDX_GUILDS,
        size: limit,
        query: isAdmin
          ? nameMatch
          : {
              bool: {
                must: [nameMatch],
                should: [
                  { term: { memberIds: userId } },
                  { term: { discoverable: true } },
                ],
                minimum_should_match: 1,
              },
            },
      });
      for (const hit of res.hits.hits) {
        const src = hit._source as {
          name: string;
          iconUrl: string | null;
          discoverable?: boolean;
        };
        hits.push({
          type: 'guild',
          id: String(hit._id),
          name: src.name,
          iconUrl: src.iconUrl,
          discoverable: src.discoverable,
        });
      }
    }

    if (types.has('channels') && (isAdmin || memberGuildIds.length)) {
      const must: object[] = [
        {
          bool: {
            should: [
              {
                multi_match: {
                  query,
                  fields: ['name'],
                  fuzziness: 'AUTO',
                  operator: 'or',
                },
              },
              { match_phrase_prefix: { name: { query, max_expansions: 50 } } },
              {
                wildcard: {
                  'name.keyword': {
                    value: `*${query.toLowerCase().replace(/[*?\\]/g, '')}*`,
                    case_insensitive: true,
                  },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
      ];
      if (opts.guildId) {
        must.push({ term: { guildId: opts.guildId } });
      } else if (!isAdmin) {
        must.push({ terms: { guildId: memberGuildIds } });
      }
      const res = await client.search({
        index: IDX_CHANNELS,
        size: limit,
        query: { bool: { must } },
      });
      for (const hit of res.hits.hits) {
        const src = hit._source as {
          guildId: string | null;
          name: string;
          channelType: string;
        };
        hits.push({
          type: 'channel',
          id: String(hit._id),
          guildId: src.guildId,
          name: src.name,
          channelType: src.channelType as never,
        });
      }
    }

    if (types.has('users') && (isAdmin || visibleUserIds.length)) {
      const must: object[] = [
        {
          bool: {
            should: [
              {
                multi_match: {
                  query,
                  fields: ['username^2', 'displayName'],
                  fuzziness: 'AUTO',
                  operator: 'or',
                },
              },
              {
                multi_match: {
                  query,
                  fields: ['username', 'displayName'],
                  type: 'phrase_prefix',
                },
              },
              {
                wildcard: {
                  'username.keyword': {
                    value: `*${query.toLowerCase().replace(/[*?\\]/g, '')}*`,
                    case_insensitive: true,
                  },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
      ];
      if (!isAdmin) {
        must.push({ ids: { values: visibleUserIds } });
      }
      const res = await client.search({
        index: IDX_USERS,
        size: limit,
        query: { bool: { must } },
      });
      for (const hit of res.hits.hits) {
        const src = hit._source as {
          username: string;
          displayName: string;
          avatarUrl: string | null;
        };
        hits.push({
          type: 'user',
          id: String(hit._id),
          username: src.username,
          displayName: src.displayName,
          avatarUrl: src.avatarUrl,
        });
      }
    }

    if (types.has('messages')) {
      const accessShould: object[] = [];
      if (opts.channelId) {
        accessShould.push({ term: { channelId: opts.channelId } });
      } else if (opts.guildId) {
        accessShould.push({ term: { guildId: opts.guildId } });
      } else if (isAdmin) {
        // platform admin: tüm mesajlar
      } else {
        if (memberGuildIds.length) {
          accessShould.push({ terms: { guildId: memberGuildIds } });
        }
        if (dmIds.length) {
          accessShould.push({ terms: { dmChannelId: dmIds } });
        }
      }
      const canSearchMessages = isAdmin || accessShould.length > 0;
      if (canSearchMessages) {
        const escaped = query.replace(/([+\-=&|><!(){}\[\]^"~*?:\\/])/g, '\\$1');
        const res = await client.search({
          index: IDX_MESSAGES,
          size: limit,
          query: {
            bool: {
              must: [
                {
                  bool: {
                    should: [
                      {
                        multi_match: {
                          query,
                          fields: ['content^3', 'authorName^2', 'attachmentNames'],
                          type: 'best_fields',
                          operator: 'or',
                          fuzziness: 'AUTO',
                          prefix_length: 1,
                        },
                      },
                      {
                        multi_match: {
                          query,
                          fields: ['content', 'authorName', 'attachmentNames'],
                          type: 'phrase_prefix',
                          max_expansions: 50,
                        },
                      },
                      {
                        simple_query_string: {
                          query: escaped,
                          fields: ['content', 'authorName', 'attachmentNames'],
                          default_operator: 'or',
                          analyze_wildcard: true,
                        },
                      },
                      {
                        wildcard: {
                          'authorName.keyword': {
                            value: `*${escaped.toLowerCase()}*`,
                            case_insensitive: true,
                          },
                        },
                      },
                    ],
                    minimum_should_match: 1,
                  },
                },
              ],
              ...(accessShould.length
                ? { filter: [{ bool: { should: accessShould, minimum_should_match: 1 } }] }
                : {}),
            },
          },
          highlight: {
            fields: { content: { fragment_size: 120, number_of_fragments: 1 } },
          },
        });
        for (const hit of res.hits.hits) {
          const src = hit._source as {
            channelId: string;
            guildId: string | null;
            dmChannelId: string | null;
            authorId: string;
            authorName: string;
            content: string;
            createdAt: string;
            threadRootId?: string | null;
          };
          const snippet =
            (hit.highlight?.content?.[0] as string | undefined) ??
            src.content.slice(0, 120);
          hits.push({
            type: 'message',
            id: String(hit._id),
            channelId: src.channelId,
            guildId: src.guildId,
            dmChannelId: src.dmChannelId,
            authorId: src.authorId,
            authorName: src.authorName,
            content: src.content,
            snippet,
            createdAt: src.createdAt,
            threadRootId: src.threadRootId ?? null,
          });
        }
      }
    }

    return { query, hits };
  }
}
