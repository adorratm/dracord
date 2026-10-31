import { Controller, Get, Optional, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { BotGatewayService } from '@/platform/bot-gateway.service';
import { BOT_GATEWAY_PATH, BOT_GATEWAY_STATUS } from '@/platform/bot-gateway.stub';
import { readInstanceShard } from '@/platform/gateway-shard';

/**
 * Fluxer-benzeri endpoint discovery.
 * İstemciler / botlar base URL uydurmasın — bu nesneden okusun.
 */
@Controller('.well-known')
export class WellKnownController {
  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly botGateway?: BotGatewayService,
  ) {}

  @Get('dracord')
  dracord(@Req() req: Request) {
    const api =
      this.config.get<string>('API_PUBLIC_URL')?.replace(/\/$/, '') ||
      `${req.protocol}://${req.get('host')}`;
    const web =
      this.config.get<string>('WEB_PUBLIC_URL')?.replace(/\/$/, '') ||
      'https://dracord.com.tr';
    const gateway =
      this.config.get<string>('GATEWAY_PUBLIC_URL')?.replace(/\/$/, '') || api;
    const cdn =
      this.config.get<string>('CDN_PUBLIC_URL')?.replace(/\/$/, '') ||
      `${api}/uploads`;
    const docs =
      this.config.get<string>('DOCS_PUBLIC_URL')?.replace(/\/$/, '') ||
      `${web}/docs`;

    const { shardId, shardCount } = readInstanceShard(this.config);

    return {
      name: 'dracord',
      version: 1,
      endpoints: {
        api_public: api,
        gateway,
        bot_gateway: `${api}${BOT_GATEWAY_PATH}`,
        bot_gateway_transport: 'socket.io',
        cdn,
        web,
        docs,
        media_gif: `${api}/media/tenor`,
        reports: `${api}/reports`,
        openapi: `${api}/openapi.json`,
        oauth_authorize: `${web}/oauth/authorize`,
        oauth_token: `${api}/oauth2/token`,
        admin: this.config.get<string>('ADMIN_PUBLIC_URL')?.replace(/\/$/, '') || undefined,
      },
      features: {
        platform_api: this.config.get<string>('PLATFORM_API') === 'true',
        platform_oauth: this.config.get<string>('PLATFORM_OAUTH') === 'true',
        activity_cas: this.config.get<string>('ACTIVITY_CAS') === 'true',
        billiards_authority:
          this.config.get<string>('ACTIVITY_BILLIARDS_AUTHORITY') === 'true',
        bot_gateway: BOT_GATEWAY_STATUS,
        gateway_shard: true,
        gif_provider: 'klipy',
        redis_adapter:
          this.config.get<string>('SOCKET_REDIS_REQUIRED') === 'true' ||
          Boolean(this.config.get<string>('REDIS_URL')),
      },
      /**
       * Gateway shard MVP — Discord-parity hash:
       * `(BigInt(guildId) >> 22n) % shard_count`
       * Identify: `{ op:2, d:{ token, shard:[id,count] } }`
       */
      instance: {
        shard_id: shardId,
        shard_count: shardCount,
        id: this.config.get<string>('INSTANCE_ID') || `api-${shardId || 0}`,
        shard_algorithm: 'discord_guild_hash_v1',
      },
      bot_gateway_stats: this.botGateway?.stats() ?? null,
    };
  }
}
