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
import { SocketEvents, type VoiceStatePayload } from '@dracord/types';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../messages/messages.service';
import { PresenceService } from '../presence/presence.service';
import { VoicePresenceService } from '../voice/voice-presence.service';
import { WsJwtGuard } from './ws-jwt.guard';

interface WsUser {
  sub: string;
  email: string;
  username: string;
}

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

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly messages: MessagesService,
    private readonly presence: PresenceService,
    private readonly voicePresence: VoicePresenceService,
  ) {}

  afterInit(server: Server) {
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
      await this.presence.updateStatus(user.sub, 'ONLINE');
      this.server.emit(SocketEvents.PRESENCE_UPDATE, {
        userId: user.sub,
        status: 'ONLINE',
      });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.data?.user as WsUser | undefined;
    if (!user?.sub) return;
    try {
      // Socket kopunca ses presence silinmez: kısa reconnect'lerde hayalet leave olmasın.
      // Ses temizliği: explicit leave, pagehide leave, heartbeat TTL (90s).
      await this.presence.updateStatus(user.sub, 'OFFLINE');
      this.server.emit(SocketEvents.PRESENCE_UPDATE, {
        userId: user.sub,
        status: 'OFFLINE',
      });
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
    const message = await this.messages.createMessage(
      body.channelId,
      user.sub,
      body.content,
      body.attachments,
    );
    this.server
      .to(this.channelRoom(body.channelId))
      .emit(SocketEvents.MESSAGE_CREATE, message);
    return message;
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('presence:update')
  async handlePresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { status: 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE' },
  ) {
    const user = client.data.user as WsUser;
    await this.presence.updateStatus(user.sub, body.status);
    this.server.emit(SocketEvents.PRESENCE_UPDATE, {
      userId: user.sub,
      status: body.status,
    });
    return { ok: true };
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
      payload = await this.voicePresence.join(
        body.guildId,
        body.channelId,
        user.sub,
        { muted: body.muted, deafened: body.deafened },
      );
      void client.join(this.guildRoom(body.guildId));
    } else {
      // leave all channels in guild — client should send previous channelId via optional prev
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

  private channelRoom(channelId: string) {
    return `channel:${channelId}`;
  }
}
