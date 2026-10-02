import { Injectable } from '@nestjs/common';
import {
  SocketEvents,
  type DmCallPayload,
  type VoiceStatePayload,
} from '@dracord/types';
import type { Server } from 'socket.io';

/**
 * İnce Socket.IO yayın katmanı — ChatGateway’e bağımlı servislerdeki
 * dairesel import’u (GuildsService ↔ MessagesService ↔ ChatGateway) kırar.
 */
@Injectable()
export class SocketBroadcastService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  broadcastVoiceState(payload: VoiceStatePayload) {
    this.server?.emit(SocketEvents.VOICE_STATE, payload);
  }

  emitDmCallToUser(userId: string, payload: DmCallPayload) {
    this.server?.to(`user:${userId}`).emit(SocketEvents.DM_CALL, payload);
  }

  emitDmCallToChannel(channelId: string, payload: DmCallPayload) {
    this.server?.to(`channel:${channelId}`).emit(SocketEvents.DM_CALL, payload);
  }

  broadcastPresence(payload: {
    userId: string;
    status: string;
    customStatus?: string | null;
  }) {
    this.server?.emit(SocketEvents.PRESENCE_UPDATE, payload);
  }
}
