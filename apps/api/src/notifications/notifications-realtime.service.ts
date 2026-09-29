import { Injectable } from '@nestjs/common';
import { SocketEvents, type NotificationDto } from '@dracord/types';
import type { Server } from 'socket.io';

@Injectable()
export class NotificationsRealtimeService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, notification: NotificationDto) {
    this.server?.to(`user:${userId}`).emit(SocketEvents.NOTIFICATION_CREATE, notification);
  }

  emitMany(notifications: NotificationDto[]) {
    for (const n of notifications) {
      this.emitToUser(n.userId, n);
    }
  }
}
