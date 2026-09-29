import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VoiceMemberSummary, VoiceStatePayload } from '@dracord/types';
import Redis from 'ioredis';
import { EntityManager } from 'typeorm';
import { User } from '@/database/entities/user.entity';

/** Presence kaydı bu süre yenilenmezse hayalet üye temizlenir. */
const MEMBER_TTL_SEC = 90;

@Injectable()
export class VoicePresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(VoicePresenceService.name);
  private readonly redis: Redis | null;
  /** memory: channelKey -> (userId -> { member, expiresAt }) */
  private readonly memory = new Map<
    string,
    Map<string, { member: VoiceMemberSummary; expiresAt: number }>
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly em: EntityManager,
  ) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      void this.redis.connect().catch((err: Error) => {
        this.logger.warn(`Voice presence Redis unavailable: ${err.message}`);
      });
    } else {
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  private channelKey(guildId: string, channelId: string) {
    return `voice:${guildId}:${channelId}`;
  }

  private memberKey(guildId: string, channelId: string, userId: string) {
    return `voice:m:${guildId}:${channelId}:${userId}`;
  }

  private userIndexKey(userId: string) {
    return `voice:u:${userId}`;
  }

  async join(
    guildId: string,
    channelId: string,
    userId: string,
    flags?: { muted?: boolean; deafened?: boolean },
  ): Promise<VoiceStatePayload> {
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    const member: VoiceMemberSummary = {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      muted: flags?.muted ?? false,
      deafened: flags?.deafened ?? false,
    };

    // Aynı kullanıcı başka kanallardaysa çıkar
    const previous = await this.findUserChannels(userId);
    for (const prev of previous) {
      if (prev.guildId !== guildId || prev.channelId !== channelId) {
        await this.leave(prev.guildId, prev.channelId, userId);
      }
    }

    await this.setMember(guildId, channelId, member);
    return { guildId, channelId, user: member, action: 'join' };
  }

  async leave(
    guildId: string,
    channelId: string,
    userId: string,
  ): Promise<VoiceStatePayload | null> {
    const members = await this.listChannel(guildId, channelId);
    const user = members.find((m) => m.id === userId);
    if (!user) {
      await this.removeMember(guildId, channelId, userId);
      return null;
    }
    await this.removeMember(guildId, channelId, userId);
    return { guildId, channelId, user, action: 'leave' };
  }

  /** Kullanıcının tüm ses presence kayıtlarını temizle (disconnect / sekme kapanması). */
  async leaveEverywhere(userId: string): Promise<VoiceStatePayload[]> {
    const locations = await this.findUserChannels(userId);
    const payloads: VoiceStatePayload[] = [];
    for (const loc of locations) {
      const payload = await this.leave(loc.guildId, loc.channelId, userId);
      if (payload) payloads.push(payload);
    }
    return payloads;
  }

  async updateFlags(
    guildId: string,
    channelId: string,
    userId: string,
    flags: { muted?: boolean; deafened?: boolean },
  ): Promise<VoiceStatePayload | null> {
    const members = await this.listChannel(guildId, channelId);
    const current = members.find((m) => m.id === userId);
    if (!current) return null;
    const next: VoiceMemberSummary = {
      ...current,
      muted: flags.muted ?? current.muted,
      deafened: flags.deafened ?? current.deafened,
    };
    await this.setMember(guildId, channelId, next);
    return { guildId, channelId, user: next, action: 'update' };
  }

  /** Bağlı kaldığı sürece TTL yenile. */
  async heartbeat(guildId: string, channelId: string, userId: string): Promise<boolean> {
    const members = await this.listChannel(guildId, channelId);
    const current = members.find((m) => m.id === userId);
    if (!current) return false;
    await this.setMember(guildId, channelId, current);
    return true;
  }

  async listChannel(guildId: string, channelId: string): Promise<VoiceMemberSummary[]> {
    if (this.redis?.status === 'ready') {
      const chKey = this.channelKey(guildId, channelId);
      const keyType = await this.redis.type(chKey);
      // Eski hash tabanlı presence → sil (hayalet kayıtlar)
      if (keyType === 'hash') {
        await this.redis.del(chKey);
        return [];
      }
      if (keyType !== 'set' && keyType !== 'none') {
        await this.redis.del(chKey);
        return [];
      }
      const ids = await this.redis.smembers(chKey);
      const out: VoiceMemberSummary[] = [];
      for (const userId of ids) {
        const raw = await this.redis.get(this.memberKey(guildId, channelId, userId));
        if (!raw) {
          await this.redis.srem(chKey, userId);
          continue;
        }
        out.push(JSON.parse(raw) as VoiceMemberSummary);
      }
      return out;
    }

    const map = this.memory.get(this.channelKey(guildId, channelId));
    if (!map) return [];
    const now = Date.now();
    const out: VoiceMemberSummary[] = [];
    for (const [userId, entry] of map) {
      if (entry.expiresAt <= now) {
        map.delete(userId);
        continue;
      }
      out.push(entry.member);
    }
    return out;
  }

  async listGuildVoice(
    guildId: string,
  ): Promise<Record<string, VoiceMemberSummary[]>> {
    if (this.redis?.status === 'ready') {
      const keys = await this.redis.keys(`voice:${guildId}:*`);
      const out: Record<string, VoiceMemberSummary[]> = {};
      for (const k of keys) {
        // skip member keys voice:m:...
        if (k.startsWith('voice:m:') || k.startsWith('voice:u:')) continue;
        const parts = k.split(':');
        if (parts.length !== 3) continue;
        const channelId = parts[2]!;
        const members = await this.listChannel(guildId, channelId);
        if (members.length) out[channelId] = members;
      }
      return out;
    }

    const out: Record<string, VoiceMemberSummary[]> = {};
    for (const [k] of this.memory) {
      if (!k.startsWith(`voice:${guildId}:`)) continue;
      const channelId = k.split(':')[2]!;
      const members = await this.listChannel(guildId, channelId);
      if (members.length) out[channelId] = members;
    }
    return out;
  }

  private async findUserChannels(
    userId: string,
  ): Promise<Array<{ guildId: string; channelId: string }>> {
    if (this.redis?.status === 'ready') {
      const raw = await this.redis.smembers(this.userIndexKey(userId));
      return raw
        .map((entry) => {
          const [guildId, channelId] = entry.split('/');
          if (!guildId || !channelId) return null;
          return { guildId, channelId };
        })
        .filter((x): x is { guildId: string; channelId: string } => Boolean(x));
    }

    const out: Array<{ guildId: string; channelId: string }> = [];
    const now = Date.now();
    for (const [k, map] of this.memory) {
      const entry = map.get(userId);
      if (!entry) continue;
      if (entry.expiresAt <= now) {
        map.delete(userId);
        continue;
      }
      const parts = k.split(':');
      if (parts.length !== 3) continue;
      out.push({ guildId: parts[1]!, channelId: parts[2]! });
    }
    return out;
  }

  private async setMember(
    guildId: string,
    channelId: string,
    member: VoiceMemberSummary,
  ) {
    const chKey = this.channelKey(guildId, channelId);
    const mKey = this.memberKey(guildId, channelId, member.id);
    const uKey = this.userIndexKey(member.id);
    const loc = `${guildId}/${channelId}`;

    if (this.redis?.status === 'ready') {
      const pipe = this.redis.pipeline();
      pipe.set(mKey, JSON.stringify(member), 'EX', MEMBER_TTL_SEC);
      pipe.sadd(chKey, member.id);
      pipe.expire(chKey, MEMBER_TTL_SEC + 30);
      pipe.sadd(uKey, loc);
      pipe.expire(uKey, MEMBER_TTL_SEC + 30);
      await pipe.exec();
      return;
    }

    let map = this.memory.get(chKey);
    if (!map) {
      map = new Map();
      this.memory.set(chKey, map);
    }
    map.set(member.id, {
      member,
      expiresAt: Date.now() + MEMBER_TTL_SEC * 1000,
    });
  }

  private async removeMember(guildId: string, channelId: string, userId: string) {
    const chKey = this.channelKey(guildId, channelId);
    const mKey = this.memberKey(guildId, channelId, userId);
    const uKey = this.userIndexKey(userId);
    const loc = `${guildId}/${channelId}`;

    if (this.redis?.status === 'ready') {
      const pipe = this.redis.pipeline();
      pipe.del(mKey);
      pipe.srem(chKey, userId);
      pipe.srem(uKey, loc);
      await pipe.exec();
      return;
    }

    this.memory.get(chKey)?.delete(userId);
  }
}
