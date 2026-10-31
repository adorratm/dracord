import { Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { guildBelongsToShard } from './gateway-shard';

export type BotGatewaySession = {
  socketId: string;
  applicationId: string;
  botUserId: string;
  identifiedAt: number;
  /** Identify shard: [id, count] — yoksa tüm guild’ler */
  shardId: number;
  shardCount: number;
};

/**
 * Bot WS oturum kaydı + dispatch fan-out.
 * Socket.IO namespace: /v1/gateway
 */
@Injectable()
export class BotGatewayService {
  private readonly log = new Logger(BotGatewayService.name);
  /** applicationId → socket ids */
  private readonly byApp = new Map<string, Set<string>>();
  private readonly sessions = new Map<string, BotGatewaySession>();
  private readonly sockets = new Map<string, Socket>();
  private seq = 0;

  registerSocket(socket: Socket) {
    this.sockets.set(socket.id, socket);
  }

  unregisterSocket(socketId: string) {
    const sess = this.sessions.get(socketId);
    if (sess) {
      const set = this.byApp.get(sess.applicationId);
      set?.delete(socketId);
      if (set && set.size === 0) this.byApp.delete(sess.applicationId);
      this.sessions.delete(socketId);
    }
    this.sockets.delete(socketId);
  }

  identify(
    socket: Socket,
    data: {
      applicationId: string;
      botUserId: string;
      shardId?: number;
      shardCount?: number;
    },
  ): BotGatewaySession {
    this.unregisterSocket(socket.id);
    const shardCount = Math.max(1, data.shardCount ?? 1);
    const shardId = Math.max(0, data.shardId ?? 0) % shardCount;
    const sess: BotGatewaySession = {
      socketId: socket.id,
      applicationId: data.applicationId,
      botUserId: data.botUserId,
      identifiedAt: Date.now(),
      shardId,
      shardCount,
    };
    this.sessions.set(socket.id, sess);
    this.sockets.set(socket.id, socket);
    let set = this.byApp.get(data.applicationId);
    if (!set) {
      set = new Set();
      this.byApp.set(data.applicationId, set);
    }
    set.add(socket.id);
    this.log.log(
      `Bot identified app=${data.applicationId} socket=${socket.id} shard=${shardId}/${shardCount}`,
    );
    return sess;
  }

  getSession(socketId: string) {
    return this.sessions.get(socketId) ?? null;
  }

  nextSeq() {
    this.seq += 1;
    return this.seq;
  }

  /**
   * Webhook ile aynı event’leri bağlı botlara gönder.
   * payload.guildId varsa yalnızca o guild’in shard’ına abone oturumlara gider.
   */
  dispatchToApplication(
    applicationId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const set = this.byApp.get(applicationId);
    if (!set?.size) return 0;
    const packet = {
      op: 0 as const,
      t: event,
      s: this.nextSeq(),
      d: payload,
    };
    const guildId =
      typeof payload.guildId === 'string'
        ? payload.guildId
        : typeof payload.guild_id === 'string'
          ? payload.guild_id
          : null;
    let n = 0;
    for (const sid of set) {
      const sess = this.sessions.get(sid);
      const sock = this.sockets.get(sid);
      if (!sock || !sess) continue;
      if (
        guildId &&
        !guildBelongsToShard(guildId, sess.shardId, sess.shardCount)
      ) {
        continue;
      }
      sock.emit('packet', packet);
      n += 1;
    }
    return n;
  }

  stats() {
    const shards = new Map<string, number>();
    for (const s of this.sessions.values()) {
      const key = `${s.shardId}/${s.shardCount}`;
      shards.set(key, (shards.get(key) ?? 0) + 1);
    }
    return {
      connections: this.sessions.size,
      applications: this.byApp.size,
      seq: this.seq,
      shards: Object.fromEntries(shards),
    };
  }
}
