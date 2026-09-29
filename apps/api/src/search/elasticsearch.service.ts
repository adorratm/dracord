import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

export const IDX_MESSAGES = 'dracord-messages';
export const IDX_GUILDS = 'dracord-guilds';
export const IDX_CHANNELS = 'dracord-channels';
export const IDX_USERS = 'dracord-users';

@Injectable()
export class ElasticsearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ElasticsearchService.name);
  readonly client: Client | null;
  private ready = false;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('ELASTICSEARCH_URL');
    this.client = url
      ? new Client({
          node: url,
          // ES 8 single-node local: no auth
        })
      : null;
  }

  isReady() {
    return this.ready && Boolean(this.client);
  }

  async onModuleInit() {
    if (!this.client) {
      this.logger.warn('ELASTICSEARCH_URL yok — arama devre dışı');
      return;
    }
    try {
      await this.client.ping();
      await this.ensureIndices();
      this.ready = true;
      this.logger.log('Elasticsearch hazır');
    } catch (err) {
      this.ready = false;
      this.logger.warn(`Elasticsearch bağlanamadı: ${(err as Error).message}`);
    }
  }

  /** Mesaj indeksi boş mu? (boot reindex için) */
  async messageIndexCount(): Promise<number> {
    if (!this.client || !this.ready) return -1;
    try {
      const res = await this.client.count({ index: IDX_MESSAGES });
      return typeof res.count === 'number' ? res.count : 0;
    } catch {
      return -1;
    }
  }

  async onModuleDestroy() {
    await this.client?.close();
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    if (!this.client) return { ok: false, detail: 'not_configured' };
    try {
      await this.client.ping();
      return { ok: true, detail: 'up' };
    } catch {
      return { ok: false, detail: 'down' };
    }
  }

  private async ensureIndices() {
    if (!this.client) return;
    const specs: Array<{ index: string; body: Record<string, unknown> }> = [
      {
        index: IDX_MESSAGES,
        body: {
          mappings: {
            properties: {
              channelId: { type: 'keyword' },
              guildId: { type: 'keyword' },
              dmChannelId: { type: 'keyword' },
              authorId: { type: 'keyword' },
              authorName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              content: { type: 'text', analyzer: 'standard' },
              attachmentNames: { type: 'text' },
              createdAt: { type: 'date' },
            },
          },
        },
      },
      {
        index: IDX_GUILDS,
        body: {
          mappings: {
            properties: {
              name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              iconUrl: { type: 'keyword', index: false },
              discoverable: { type: 'boolean' },
              memberIds: { type: 'keyword' },
            },
          },
        },
      },
      {
        index: IDX_CHANNELS,
        body: {
          mappings: {
            properties: {
              guildId: { type: 'keyword' },
              dmChannelId: { type: 'keyword' },
              name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              channelType: { type: 'keyword' },
            },
          },
        },
      },
      {
        index: IDX_USERS,
        body: {
          mappings: {
            properties: {
              username: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              displayName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              avatarUrl: { type: 'keyword', index: false },
            },
          },
        },
      },
    ];

    for (const spec of specs) {
      const exists = await this.client.indices.exists({ index: spec.index });
      if (!exists) {
        await this.client.indices.create({
          index: spec.index,
          mappings: (spec.body as { mappings: Record<string, unknown> }).mappings,
        } as never);
      }
    }
  }
}
