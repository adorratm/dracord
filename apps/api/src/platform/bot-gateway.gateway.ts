import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { PlatformApplication } from '@/database/entities/platform-application.entity';
import { isPlatformApiEnabled } from './platform-enabled';
import { BotGatewayService } from './bot-gateway.service';
import { BOT_GATEWAY_PATH } from './bot-gateway.stub';
import {
  parseIdentifyShard,
  readInstanceShard,
} from './gateway-shard';

const HEARTBEAT_MS = 41_250;
const IDENTIFY_TIMEOUT_MS = 30_000;

type IncomingPacket =
  | { op: 1; d?: number | null } // Heartbeat
  | {
      op: 2;
      d: { token?: string; intents?: number; shard?: [number, number] };
    }; // Identify

@WebSocketGateway({
  namespace: BOT_GATEWAY_PATH,
  cors: { origin: true, credentials: true },
  transports: ['websocket'],
})
export class BotGatewayGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger(BotGatewayGateway.name);
  private readonly identifyTimers = new Map<string, NodeJS.Timeout>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly em: EntityManager,
    private readonly bots: BotGatewayService,
  ) {}

  handleConnection(client: Socket) {
    if (!isPlatformApiEnabled(this.config)) {
      client.emit('packet', {
        op: 9,
        d: false,
      });
      client.disconnect(true);
      return;
    }
    const { shardId, shardCount } = readInstanceShard(this.config);
    this.bots.registerSocket(client);
    client.emit('packet', {
      op: 10,
      d: {
        heartbeat_interval: HEARTBEAT_MS,
        shard_id: shardId,
        shard_count: shardCount,
      },
    });
    const t = setTimeout(() => {
      if (!this.bots.getSession(client.id)) {
        client.emit('packet', { op: 9, d: false });
        client.disconnect(true);
      }
    }, IDENTIFY_TIMEOUT_MS);
    this.identifyTimers.set(client.id, t);
    this.log.debug(`Bot gateway connect ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const t = this.identifyTimers.get(client.id);
    if (t) clearTimeout(t);
    this.identifyTimers.delete(client.id);
    this.bots.unregisterSocket(client.id);
  }

  @SubscribeMessage('packet')
  async onPacket(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: IncomingPacket,
  ) {
    if (!body || typeof body !== 'object') return;
    if (body.op === 1) {
      client.emit('packet', { op: 11 });
      return;
    }
    if (body.op === 2) {
      await this.handleIdentify(client, body.d?.token ?? '', body.d?.shard);
    }
  }

  /** Alternatif: doğrudan identify event */
  @SubscribeMessage('identify')
  async onIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { token?: string; shard?: [number, number] },
  ) {
    await this.handleIdentify(client, body?.token ?? '', body?.shard);
  }

  private async handleIdentify(
    client: Socket,
    token: string,
    shardRaw?: [number, number],
  ) {
    const t = this.identifyTimers.get(client.id);
    if (t) clearTimeout(t);
    this.identifyTimers.delete(client.id);

    const raw = token.trim();
    if (!raw) {
      client.emit('packet', { op: 9, d: false });
      client.disconnect(true);
      return;
    }
    const { shardId: instanceShardId, shardCount } = readInstanceShard(
      this.config,
    );
    let shardId = 0;
    let sessCount = 1;
    if (shardRaw) {
      const parsed = parseIdentifyShard(shardRaw, shardCount);
      if (!parsed) {
        client.emit('packet', {
          op: 9,
          d: { error: 'invalid_shard', shard_count: shardCount },
        });
        client.disconnect(true);
        return;
      }
      shardId = parsed[0];
      sessCount = parsed[1];
      // Multi-instance: bu pod yalnızca kendi dilimini kabul eder
      if (shardCount > 1 && shardId !== instanceShardId) {
        client.emit('packet', {
          op: 9,
          d: {
            error: 'wrong_shard',
            shard_id: instanceShardId,
            shard_count: shardCount,
            requested: shardId,
          },
        });
        client.disconnect(true);
        return;
      }
    } else if (shardCount > 1) {
      // Shard zorunlu değil (tek bağlantı = tüm dilim bu süreçte) — instance dilimi
      shardId = instanceShardId;
      sessCount = shardCount;
    }

    const hash = createHash('sha256').update(raw).digest('hex');
    const app = await this.em.findOne(PlatformApplication, {
      where: { botTokenHash: hash },
    });
    if (!app?.botUserId) {
      client.emit('packet', { op: 9, d: false });
      client.disconnect(true);
      return;
    }
    this.bots.identify(client, {
      applicationId: app.id,
      botUserId: app.botUserId,
      shardId,
      shardCount: sessCount,
    });
    client.emit('packet', {
      op: 0,
      t: 'READY',
      s: this.bots.nextSeq(),
      d: {
        v: 1,
        user: { id: app.botUserId, bot: true, applicationId: app.id },
        heartbeat_interval: HEARTBEAT_MS,
        session_id: client.id,
        shard: [shardId, sessCount] as [number, number],
      },
    });
  }
}
