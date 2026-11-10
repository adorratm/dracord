import { Injectable } from '@nestjs/common';
import {
  SocketEvents,
  type DmCallPayload,
  type RemoteControlStatePayload,
  type UserActivity,
  type UserUpdatePayload,
  type VoiceChannelStatusPayload,
  type VoiceStatePayload,
  type VoiceTakeoverPayload,
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

  /** Ayrılma sonrası (ör. boşalan kanalın durum metnini sil) — ChatGateway bağlar */
  private voiceLeaveHook: ((payload: VoiceStatePayload) => void) | null = null;

  setVoiceLeaveHook(fn: ((payload: VoiceStatePayload) => void) | null) {
    this.voiceLeaveHook = fn;
  }

  broadcastVoiceState(payload: VoiceStatePayload) {
    this.server?.emit(SocketEvents.VOICE_STATE, payload);
    if (payload.action === 'leave' || payload.action === 'move') {
      try {
        this.voiceLeaveHook?.(payload);
      } catch {
        /* ignore */
      }
    }
  }

  /** Genel guild odası yayını */
  /** E2 — kapatılan oturumların soketlerini düşür (istemci oturumu kapatır) */
  async disconnectSessions(userId: string, sessionIds: string[]) {
    if (!this.server || !sessionIds.length) return;
    const set = new Set(sessionIds);
    try {
      const socks = await this.server.in(`user:${userId}`).fetchSockets();
      for (const s of socks) {
        const sid = (s.data as { user?: { sid?: string } })?.user?.sid;
        if (sid && set.has(sid)) {
          s.emit('session:revoked', { sessionId: sid });
          s.disconnect(true);
        }
      }
    } catch {
      /* adapter yoksa yok say */
    }
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    if (!this.server || !userIds.length) return;
    this.server.to(userIds.map((id) => `user:${id}`)).emit(event, payload);
  }

  emitToGuild(guildId: string, event: string, payload: unknown) {
    this.server?.to(`guild:${guildId}`).emit(event, payload);
  }

  broadcastVoiceChannelStatus(payload: VoiceChannelStatusPayload) {
    this.server?.to(`guild:${payload.guildId}`).emit(SocketEvents.VOICE_CHANNEL_STATUS, payload);
  }

  broadcastRemoteControlState(payload: RemoteControlStatePayload) {
    const guildRoom = `guild:${payload.guildId}`;
    this.server?.to(guildRoom).emit(SocketEvents.REMOTE_CONTROL_STATE, payload);
    this.server
      ?.to(`user:${payload.sharerId}`)
      .emit(SocketEvents.REMOTE_CONTROL_STATE, payload);
    if (payload.controllerId) {
      this.server
        ?.to(`user:${payload.controllerId}`)
        .emit(SocketEvents.REMOTE_CONTROL_STATE, payload);
    }
  }

  emitVoiceTakeover(userId: string, payload: VoiceTakeoverPayload) {
    this.server?.to(`user:${userId}`).emit(SocketEvents.VOICE_TAKEOVER, payload);
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
    activity?: UserActivity | null;
    activities?: UserActivity[] | null;
  }) {
    this.server?.emit(SocketEvents.PRESENCE_UPDATE, payload);
  }

  broadcastUserUpdate(payload: UserUpdatePayload) {
    this.server?.emit(SocketEvents.USER_UPDATE, payload);
  }

  emitToChannel(channelId: string, event: string, payload: unknown) {
    this.server?.to(`channel:${channelId}`).emit(event, payload);
  }
}
