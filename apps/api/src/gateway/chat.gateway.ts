import { Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import {
  SocketEvents,
  type DmCallPayload,
  type VoiceStatePayload,
  type VoiceSyncPayload,
} from '@dracord/types';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { ChannelsService } from '@/channels/channels.service';
import { UserStatus } from '@/database/enums';
import { MessagesService } from '@/messages/messages.service';
import { MessagesRealtimeService } from '@/messages/messages-realtime.service';
import { NotificationsRealtimeService } from '@/notifications/notifications-realtime.service';
import { PresenceService } from '@/presence/presence.service';
import { VoicePresenceService } from '@/voice/voice-presence.service';
import { WsJwtGuard } from './ws-jwt.guard';
import { GatewayMetricsService } from './gateway-metrics.service';
import { SocketAdapterStateService } from './socket-adapter-state.service';
import { SocketBroadcastService } from './socket-broadcast.service';

interface WsUser {
  sub: string;
  email: string;
  username: string;
}

const OFFLINE_GRACE_MS = 25_000;
/** Ses kanalında görünüp soketi olmayan hayalet üye temizliği (TTL ile hizalı). 0 = kapalı */
const VOICE_ORPHAN_GRACE_MS = 90_000;

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'https://dracord.com.tr',
      'https://www.dracord.com.tr',
      'https://admin.dracord.com.tr',
    ],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly socketsByUser = new Map<string, Set<string>>();
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>();
  private readonly voiceOrphanTimers = new Map<string, NodeJS.Timeout>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly messages: MessagesService,
    private readonly presence: PresenceService,
    private readonly voicePresence: VoicePresenceService,
    private readonly channels: ChannelsService,
    private readonly notificationsRealtime: NotificationsRealtimeService,
    private readonly messagesRealtime: MessagesRealtimeService,
    private readonly broadcast: SocketBroadcastService,
    private readonly adapterState: SocketAdapterStateService,
    private readonly gatewayMetrics: GatewayMetricsService,
  ) {}

  afterInit(server: Server) {
    this.notificationsRealtime.setServer(server);
    this.messagesRealtime.setServer(server);
    this.broadcast.setServer(server);
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    const redisRequired =
      this.config.get<string>('SOCKET_REDIS_REQUIRED') === 'true';
    try {
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      const subClient = pubClient.duplicate();
      void Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          server.adapter(createAdapter(pubClient, subClient));
          this.adapterState.markEnabled();
          this.logger.log('Socket.io Redis adapter enabled');
        })
        .catch((err: Error) => {
          this.adapterState.markFailed(err.message);
          if (redisRequired) {
            this.logger.error(
              `Redis adapter required but failed: ${err.message}`,
            );
          } else {
            this.logger.warn(`Redis adapter skipped: ${err.message}`);
          }
        });
    } catch (err) {
      const msg = (err as Error).message;
      this.adapterState.markFailed(msg);
      if (redisRequired) {
        this.logger.error(`Redis adapter required but failed: ${msg}`);
      } else {
        this.logger.warn(`Redis adapter skipped: ${msg}`);
      }
    }
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as { token?: string }).token ??
        client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) {
        client.disconnect(true);
        return;
      }
      const user = this.jwt.verify<WsUser>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      client.data.user = user;
      void client.join(`user:${user.sub}`);

      const pending = this.offlineTimers.get(user.sub);
      if (pending) {
        clearTimeout(pending);
        this.offlineTimers.delete(user.sub);
        this.gatewayMetrics.recordGraceCancelled();
      }
      const orphanPending = this.voiceOrphanTimers.get(user.sub);
      if (orphanPending) {
        clearTimeout(orphanPending);
        this.voiceOrphanTimers.delete(user.sub);
        this.gatewayMetrics.recordGraceCancelled();
      }

      let set = this.socketsByUser.get(user.sub);
      if (!set) {
        set = new Set();
        this.socketsByUser.set(user.sub, set);
      }
      set.add(client.id);
      this.gatewayMetrics.recordConnect();

      const pub = await this.presence.markConnected(user.sub);
      this.server.emit(SocketEvents.PRESENCE_UPDATE, {
        userId: user.sub,
        status: pub.status,
        customStatus: pub.customStatus ?? null,
        activity: pub.activity ?? null,
        activities: pub.activities ?? null,
      });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.data?.user as WsUser | undefined;
    if (!user?.sub) return;
    try {
      this.gatewayMetrics.recordDisconnect();
      const set = this.socketsByUser.get(user.sub);
      set?.delete(client.id);
      if (set && set.size > 0) return;
      this.socketsByUser.delete(user.sub);

      const existing = this.offlineTimers.get(user.sub);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.offlineTimers.delete(user.sub);
        // Hâlâ soket yoksa çevrimdışı işaretle
        if (this.socketsByUser.has(user.sub)) return;
        void (async () => {
          // Ses kanalındaysa kısa süre online tut; ardından hayalet roster temizle
          try {
            const locs = await this.voicePresence.getUserVoiceLocations(user.sub);
            if (locs.length > 0) {
              const pub = await this.presence.markConnected(user.sub);
              this.server.emit(SocketEvents.PRESENCE_UPDATE, {
                userId: user.sub,
                status: pub.status,
                customStatus: pub.customStatus ?? null,
                activity: pub.activity ?? null,
                activities: pub.activities ?? null,
              });
              this.scheduleVoiceOrphanCleanup(user.sub);
              return;
            }
          } catch (err) {
            this.logger.warn(
              `Voice check on disconnect failed: ${(err as Error).message}`,
            );
          }
          const pub = await this.presence.markDisconnected(user.sub);
          this.gatewayMetrics.recordOffline();
          this.server.emit(SocketEvents.PRESENCE_UPDATE, {
            userId: user.sub,
            status: pub.status,
            customStatus: pub.customStatus ?? null,
            activity: pub.activity ?? null,
            activities: pub.activities ?? null,
          });
        })().catch((err: Error) => {
          this.logger.warn(`Disconnect cleanup failed: ${err.message}`);
        });
      }, OFFLINE_GRACE_MS);
      this.offlineTimers.set(user.sub, timer);
    } catch (err) {
      this.logger.warn(`Disconnect cleanup failed: ${(err as Error).message}`);
    }
  }

  /** Soketsiz ses presence → leaveEverywhere + offline */
  private scheduleVoiceOrphanCleanup(userId: string) {
    if (this.config.get<string>('VOICE_ORPHAN_CLEANUP') === 'false') return;
    const prev = this.voiceOrphanTimers.get(userId);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      this.voiceOrphanTimers.delete(userId);
      if (this.socketsByUser.has(userId)) return;
      void (async () => {
        const left = await this.voicePresence.leaveEverywhere(userId);
        if (left.length > 0) {
          this.gatewayMetrics.recordVoiceOrphanClear(left.length);
          for (const payload of left) {
            this.server.emit(SocketEvents.VOICE_STATE, payload);
          }
          this.logger.log(
            `Voice orphan cleaned user=${userId} channels=${left.length}`,
          );
        }
        if (this.socketsByUser.has(userId)) return;
        const pub = await this.presence.markDisconnected(userId);
        this.gatewayMetrics.recordOffline();
        this.server.emit(SocketEvents.PRESENCE_UPDATE, {
          userId,
          status: pub.status,
          customStatus: pub.customStatus ?? null,
          activity: pub.activity ?? null,
          activities: pub.activities ?? null,
        });
      })().catch((err: Error) => {
        this.logger.warn(`Voice orphan cleanup failed: ${err.message}`);
      });
    }, VOICE_ORPHAN_GRACE_MS);
    this.voiceOrphanTimers.set(userId, timer);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SocketEvents.CHANNEL_JOIN)
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId: string },
  ) {
    const user = client.data.user as WsUser;
    if (!body?.channelId) throw new WsException('channelId gerekli');
    try {
      await this.channels.assertChannelAccess(body.channelId, user.sub);
    } catch (err) {
      throw new WsException((err as Error).message || 'Forbidden');
    }
    void client.join(this.channelRoom(body.channelId));
    return { ok: true, channelId: body.channelId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SocketEvents.CHANNEL_LEAVE)
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId: string },
  ) {
    if (!body?.channelId) throw new WsException('channelId gerekli');
    void client.leave(this.channelRoom(body.channelId));
    return { ok: true, channelId: body.channelId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SocketEvents.TYPING_START)
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId: string },
  ) {
    const user = client.data.user as WsUser;
    if (!body?.channelId) throw new WsException('channelId gerekli');
    try {
      await this.channels.assertChannelAccess(body.channelId, user.sub);
    } catch (err) {
      throw new WsException((err as Error).message || 'Forbidden');
    }
    client.to(this.channelRoom(body.channelId)).emit(SocketEvents.TYPING_START, {
      channelId: body.channelId,
      userId: user.sub,
      username: user.username,
    });
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('message:create')
  async handleMessageCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      channelId: string;
      content: string;
      attachments?: Array<{
        id: string;
        url: string;
        filename: string;
        contentType: string;
        size: number;
      }>;
    },
  ) {
    const user = client.data.user as WsUser;
    const { message } = await this.messages.createMessage(
      body.channelId,
      user.sub,
      body.content,
      body.attachments,
    );
    // createMessage zaten realtime emit ediyor
    return message;
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('presence:update')
  async handlePresence(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { status: 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE'; customStatus?: string | null },
  ) {
    const user = client.data.user as WsUser;
    const pub = await this.presence.updateStatus(
      user.sub,
      body.status as UserStatus,
      { customStatus: body.customStatus, manual: true },
    );
    this.server.emit(SocketEvents.PRESENCE_UPDATE, {
      userId: user.sub,
      status: pub.status,
      customStatus: pub.customStatus ?? null,
      activity: pub.activity ?? null,
      activities: pub.activities ?? null,
    });
    return { ok: true, user: pub };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SocketEvents.VOICE_SYNC)
  async handleVoiceSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { guildId: string },
  ): Promise<VoiceSyncPayload> {
    const user = client.data.user as WsUser;
    if (!body?.guildId) throw new WsException('guildId gerekli');
    try {
      // Üyelik + VIEW_CHANNEL filtresi (yan etki: roster erişim kontrolü)
      await this.channels.listGuildChannels(body.guildId, user.sub);
    } catch (err) {
      throw new WsException((err as Error).message || 'Forbidden');
    }
    void client.join(this.guildRoom(body.guildId));
    const membersByChannel = await this.voicePresence.listGuildVoice(body.guildId);
    const payload: VoiceSyncPayload = { guildId: body.guildId, membersByChannel };
    this.gatewayMetrics.recordVoiceSync();
    client.emit(SocketEvents.VOICE_SYNC, payload);
    return payload;
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SocketEvents.VOICE_STATE)
  async handleVoiceState(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      guildId: string;
      channelId: string | null;
      muted?: boolean;
      deafened?: boolean;
    },
  ) {
    const user = client.data.user as WsUser;
    let payload: VoiceStatePayload | null = null;

    if (body.channelId) {
      const result = await this.voicePresence.join(
        body.guildId,
        body.channelId,
        user.sub,
        { muted: body.muted, deafened: body.deafened },
      );
      for (const left of result.left) {
        this.server.emit(SocketEvents.VOICE_STATE, left);
      }
      payload = result.joined;
      void client.join(this.guildRoom(body.guildId));
    } else {
      const map = await this.voicePresence.listGuildVoice(body.guildId);
      for (const [chId, members] of Object.entries(map)) {
        if (members.some((m) => m.id === user.sub)) {
          payload = await this.voicePresence.leave(body.guildId, chId, user.sub);
        }
      }
    }

    if (payload) {
      this.server.emit(SocketEvents.VOICE_STATE, payload);
    }
    return payload;
  }

  broadcastVoiceState(payload: VoiceStatePayload) {
    this.broadcast.broadcastVoiceState(payload);
  }

  emitToUser(userId: string, payload: DmCallPayload) {
    this.broadcast.emitDmCallToUser(userId, payload);
  }

  async emitDmCallToChannel(channelId: string, payload: DmCallPayload) {
    this.broadcast.emitDmCallToChannel(channelId, payload);
  }

  broadcastPresence(payload: {
    userId: string;
    status: string;
    customStatus?: string | null;
  }) {
    this.broadcast.broadcastPresence(payload);
  }

  private channelRoom(channelId: string) {
    return `channel:${channelId}`;
  }

  private guildRoom(guildId: string) {
    return `guild:${guildId}`;
  }
}
