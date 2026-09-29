import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { MessageDto } from '@dracord/types';
import { SocketEvents } from '@dracord/types';

@Injectable()
export class MessagesRealtimeService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitCreate(channelId: string, message: MessageDto) {
    this.server?.to(`channel:${channelId}`).emit(SocketEvents.MESSAGE_CREATE, message);
  }

  emitUpdate(channelId: string, message: MessageDto) {
    this.server?.to(`channel:${channelId}`).emit(SocketEvents.MESSAGE_UPDATE, message);
  }

  emitDelete(channelId: string, messageId: string) {
    this.server
      ?.to(`channel:${channelId}`)
      .emit(SocketEvents.MESSAGE_DELETE, { id: messageId, channelId });
  }
}
