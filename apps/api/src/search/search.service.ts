import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SearchHit, SearchResponse } from '@dracord/types';
import { EntityManager, In } from 'typeorm';
import { DMChannelMember } from '@/database/entities/dm-channel-member.entity';
import { Friendship } from '@/database/entities/friendship.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { FriendshipStatus } from '@/database/enums';
import {
  ElasticsearchService,
  IDX_CHANNELS,
  IDX_GUILDS,
  IDX_MESSAGES,
  IDX_USERS,
} from './elasticsearch.service';

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
    if (!this.es.client || !this.es.isReady()) {
      throw new ServiceUnavailableException('Arama servisi kullanılamıyor');
    }
    const query = q.trim();
    if (query.length < 1) {
      return { query, hits: [] };
    }

    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const types = new Set(
      (opts.types?.length ? opts.types : ['guilds', 'channels', 'users', 'messages']).map((t) =>
        t.toLowerCase(),
      ),
    );

    const memberships = await this.em.find(GuildMember, {
      where: { userId },
      select: { guildId: true },
    });
    const memberGuildIds = memberships.map((m) => m.guildId);

    const dmMemberships = await this.em.find(DMChannelMember, {
      where: { userId },
      select: { dmChannelId: true },
    });
    const dmIds = dmMemberships.map((m) => m.dmChannelId);

    const friendships = await this.em.find(Friendship, {
      where: [
        { userId, status: FriendshipStatus.ACCEPTED },
        { friendId: userId, status: FriendshipStatus.ACCEPTED },
      ],
    });
    const friendIds = friendships.map((f) => (f.userId === userId ? f.friendId : f.userId));

    // Users who share a guild
    let coMemberIds: string[] = [];
    if (memberGuildIds.length) {
      const co = await this.em.find(GuildMember, {
        where: { guildId: In(memberGuildIds) },
        select: { userId: true },
      });
      coMemberIds = [...new Set(co.map((c) => c.userId).filter((id) => id !== userId))];
    }
    const visibleUserIds = [...new Set([...friendIds, ...coMemberIds])];

    const hits: SearchHit[] = [];

    if (types.has('guilds')) {
      const res = await this.es.client.search({
        index: IDX_GUILDS,
        size: limit,
        query: {
          bool: {
            must: [{ multi_match: { query, fields: ['name'], fuzziness: 'AUTO' } }],
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

    if (types.has('channels') && memberGuildIds.length) {
      const guildFilter = opts.guildId
        ? { term: { guildId: opts.guildId } }
        : { terms: { guildId: memberGuildIds } };
      const res = await this.es.client.search({
        index: IDX_CHANNELS,
        size: limit,
        query: {
          bool: {
            must: [
              { multi_match: { query, fields: ['name'], fuzziness: 'AUTO' } },
              guildFilter,
            ],
          },
        },
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

    if (types.has('users') && visibleUserIds.length) {
      const res = await this.es.client.search({
        index: IDX_USERS,
        size: limit,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ['username', 'displayName'],
                  fuzziness: 'AUTO',
                },
              },
              { ids: { values: visibleUserIds } },
            ],
          },
        },
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
      } else {
        if (memberGuildIds.length) {
          accessShould.push({ terms: { guildId: memberGuildIds } });
        }
        if (dmIds.length) {
          accessShould.push({ terms: { dmChannelId: dmIds } });
        }
      }
      if (accessShould.length === 0) {
        // no accessible channels
      } else {
        const res = await this.es.client.search({
          index: IDX_MESSAGES,
          size: limit,
          query: {
            bool: {
              must: [
                {
                  bool: {
                    should: [
                      {
                        match: {
                          content: {
                            query,
                            operator: 'and',
                            fuzziness: 'AUTO',
                          },
                        },
                      },
                      {
                        match_phrase_prefix: {
                          content: { query, max_expansions: 50 },
                        },
                      },
                      {
                        match: {
                          attachmentNames: { query, fuzziness: 'AUTO' },
                        },
                      },
                      {
                        match: {
                          authorName: { query, fuzziness: 'AUTO' },
                        },
                      },
                    ],
                    minimum_should_match: 1,
                  },
                },
              ],
              filter: [{ bool: { should: accessShould, minimum_should_match: 1 } }],
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
          });
        }
      }
    }

    return { query, hits };
  }
}
