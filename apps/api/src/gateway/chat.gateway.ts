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
} from '@nestjs/websockets';
import { SocketEvents, type DmCallPayload, type VoiceStatePayload } from '@dracord/types';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { UserStatus } from '@/database/enums';
import { MessagesService } from '@/messages/messages.service';
import { MessagesRealtimeService } from '@/messages/messages-realtime.service';
import { NotificationsRealtimeService } from '@/notifications/notifications-realtime.service';
import { PresenceService } from '@/presence/presence.service';
import { VoicePresenceService } from '@/voice/voice-presence.service';
import { WsJwtGuard } from './ws-jwt.guard';

interface WsUser {
  sub: string;
  email: string;
  username: string;
}

const OFFLINE_GRACE_MS = 25_000;

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://dracord.com.tr',
      'https://www.dracord.com.tr',
    ],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly socketsByUser = new Map<string, Set<string>>();
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly messages: MessagesService,
    private readonly presence: PresenceService,
    private readonly voicePresence: VoicePresenceService,
    private readonly notificationsRealtime: NotificationsRealtimeService,
    private readonly messagesRealtime: MessagesRealtimeService,
  ) {}

  afterInit(server: Server) {
    this.notificationsRealtime.setServer(server);
    this.messagesRealtime.setServer(server);
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    try {
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      const subClient = pubClient.duplicate();
      void Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          server.adapter(createAdapter(pubClient, subClient));
          this.logger.log('Socket.io Redis adapter enabled');
        })
        .catch((err: Error) => {
          this.logger.warn(`Redis adapter skipped: ${err.message}`);
        });
    } catch (err) {
      this.logger.warn(`Redis adapter skipped: ${(err as Error).message}`);
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
      }

      let set = this.socketsByUser.get(user.sub);
      if (!set) {
        set = new Set();
        this.socketsByUser.set(user.sub, set);
      }
      set.add(client.id);

      const pub = await this.presence.markConnected(user.sub);
      this.server.emit(SocketEvents.PRESENCE_UPDATE, {
        userId: user.sub,
        status: pub.status,
        customStatus: pub.customStatus ?? null,
      });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.data?.user as WsUser | undefined;
    if (!user?.sub) return;
    try {
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
        void this.presence
          .markDisconnected(user.sub)
          .then((pub) => {
            this.server.emit(SocketEvents.PRESENCE_UPDATE, {
              userId: user.sub,
              status: pub.status,
              customStatus: pub.customStatus ?? null,
            });
          })
          .catch((err: Error) => {
            this.logger.warn(`Disconnect cleanup failed: ${err.message}`);
          });
      }, OFFLINE_GRACE_MS);
      this.offlineTimers.set(user.sub, timer);
    } catch (err) {
      this.logger.warn(`Disconnect cleanup failed: ${(err as Error).message}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SocketEvents.CHANNEL_JOIN)
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId: string },
  ) {
    void client.join(this.channelRoom(body.channelId));
    return { ok: true, channelId: body.channelId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SocketEvents.CHANNEL_LEAVE)
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId: string },
  ) {
    void client.leave(this.channelRoom(body.channelId));
    return { ok: true, channelId: body.channelId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SocketEvents.TYPING_START)
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId: string },
  ) {
    const user = client.data.user as WsUser;
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
    });
    return { ok: true, user: pub };
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
    this.server.emit(SocketEvents.VOICE_STATE, payload);
  }

  emitToUser(userId: string, payload: DmCallPayload) {
    this.server.to(`user:${userId}`).emit(SocketEvents.DM_CALL, payload);
  }

  async emitDmCallToChannel(channelId: string, payload: DmCallPayload) {
    // Üye listesine erişmeden user odalarına yayın için channel room da kullanılır
    this.server.to(this.channelRoom(channelId)).emit(SocketEvents.DM_CALL, payload);
  }

  broadcastPresence(payload: {
    userId: string;
    status: string;
    customStatus?: string | null;
  }) {
    this.server.emit(SocketEvents.PRESENCE_UPDATE, payload);
  }

  private channelRoom(channelId: string) {
    return `channel:${channelId}`;
  }

  private guildRoom(guildId: string) {
    return `guild:${guildId}`;
  }
}
