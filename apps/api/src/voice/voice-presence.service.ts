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
  /** memory: guildId -> aktif ses kanalı id'leri */
  private readonly memoryGuildChannels = new Map<string, Set<string>>();

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

  private guildChannelsKey(guildId: string) {
    return `voice:guild:${guildId}:channels`;
  }

  async join(
    guildId: string,
    channelId: string,
    userId: string,
    flags?: { muted?: boolean; deafened?: boolean },
  ): Promise<{ joined: VoiceStatePayload; left: VoiceStatePayload[] }> {
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    const member: VoiceMemberSummary = {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      muted: flags?.muted ?? false,
      deafened: flags?.deafened ?? false,
      isBot: Boolean(user.isBot),
    };

    // Aynı kullanıcı başka kanallardaysa çıkar (DM araması ↔ sunucu sesi dahil)
    const previous = await this.findUserChannels(userId);
    const left: VoiceStatePayload[] = [];
    for (const prev of previous) {
      if (prev.guildId !== guildId || prev.channelId !== channelId) {
        const payload = await this.leave(prev.guildId, prev.channelId, userId);
        if (payload) left.push(payload);
      }
    }

    await this.setMember(guildId, channelId, member);
    return {
      joined: { guildId, channelId, user: member, action: 'join' },
      left,
    };
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
    flags: { muted?: boolean; deafened?: boolean; screenSharing?: boolean },
  ): Promise<VoiceStatePayload | null> {
    const members = await this.listChannel(guildId, channelId);
    const current = members.find((m) => m.id === userId);
    if (!current) return null;
    const next: VoiceMemberSummary = {
      ...current,
      muted: flags.muted ?? current.muted,
      deafened: flags.deafened ?? current.deafened,
      screenSharing: flags.screenSharing ?? current.screenSharing,
    };
    await this.setMember(guildId, channelId, next);
    return { guildId, channelId, user: next, action: 'update' };
  }

  /** Bağlı kaldığı sürece TTL yenile — yalnızca kendi member key'i. */
  async heartbeat(guildId: string, channelId: string, userId: string): Promise<boolean> {
    if (this.redis?.status === 'ready') {
      const mKey = this.memberKey(guildId, channelId, userId);
      const raw = await this.redis.get(mKey);
      if (!raw) return false;
      const chKey = this.channelKey(guildId, channelId);
      const uKey = this.userIndexKey(userId);
      const gKey = this.guildChannelsKey(guildId);
      const loc = `${guildId}/${channelId}`;
      const pipe = this.redis.pipeline();
      pipe.set(mKey, raw, 'EX', MEMBER_TTL_SEC);
      pipe.sadd(chKey, userId);
      pipe.expire(chKey, MEMBER_TTL_SEC + 30);
      pipe.sadd(gKey, channelId);
      pipe.expire(gKey, MEMBER_TTL_SEC + 60);
      pipe.sadd(uKey, loc);
      pipe.expire(uKey, MEMBER_TTL_SEC + 30);
      await pipe.exec();
      return true;
    }

    const map = this.memory.get(this.channelKey(guildId, channelId));
    const entry = map?.get(userId);
    if (!entry || entry.expiresAt <= Date.now()) return false;
    entry.expiresAt = Date.now() + MEMBER_TTL_SEC * 1000;
    return true;
  }

  async listChannel(guildId: string, channelId: string): Promise<VoiceMemberSummary[]> {
    if (this.redis?.status === 'ready') {
      const chKey = this.channelKey(guildId, channelId);
      // TYPE kontrolünü her çağrıda yapma — set bekliyoruz; hash kalıntısı SMEMBERS ile boş döner
      const ids = await this.redis.smembers(chKey);
      if (!ids.length) {
        // Eski hash kalıntısını tek seferlik temizle
        const keyType = await this.redis.type(chKey);
        if (keyType === 'hash' || (keyType !== 'set' && keyType !== 'none')) {
          await this.redis.del(chKey);
        }
        return [];
      }
      const keys = ids.map((userId) => this.memberKey(guildId, channelId, userId));
      const raws = await this.redis.mget(...keys);
      const out: VoiceMemberSummary[] = [];
      const stale: string[] = [];
      for (let i = 0; i < ids.length; i++) {
        const raw = raws[i];
        const userId = ids[i]!;
        if (!raw) {
          stale.push(userId);
          continue;
        }
        try {
          out.push(JSON.parse(raw) as VoiceMemberSummary);
        } catch {
          stale.push(userId);
        }
      }
      if (stale.length) {
        const pipe = this.redis.pipeline();
        for (const userId of stale) pipe.srem(chKey, userId);
        await pipe.exec();
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
      const channelIds = await this.redis.smembers(this.guildChannelsKey(guildId));
      const out: Record<string, VoiceMemberSummary[]> = {};
      if (!channelIds.length) return out;
      // Kanalları paralel oku
      const results = await Promise.all(
        channelIds.map(async (channelId) => {
          const members = await this.listChannel(guildId, channelId);
          return { channelId, members };
        }),
      );
      const guildKey = this.guildChannelsKey(guildId);
      const empty: string[] = [];
      for (const { channelId, members } of results) {
        if (members.length) out[channelId] = members;
        else empty.push(channelId);
      }
      if (empty.length) {
        const pipe = this.redis.pipeline();
        for (const channelId of empty) pipe.srem(guildKey, channelId);
        await pipe.exec();
      }
      return out;
    }

    const out: Record<string, VoiceMemberSummary[]> = {};
    const ids = this.memoryGuildChannels.get(guildId);
    if (!ids) return out;
    for (const channelId of ids) {
      const members = await this.listChannel(guildId, channelId);
      if (members.length) {
        out[channelId] = members;
      } else {
        ids.delete(channelId);
      }
    }
    if (ids.size === 0) this.memoryGuildChannels.delete(guildId);
    return out;
  }

  /** Kullanıcının bulunduğu ses kanal(lar)ı */
  async getUserVoiceLocations(
    userId: string,
  ): Promise<Array<{ guildId: string; channelId: string }>> {
    return this.findUserChannels(userId);
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
      const gKey = this.guildChannelsKey(guildId);
      const pipe = this.redis.pipeline();
      pipe.set(mKey, JSON.stringify(member), 'EX', MEMBER_TTL_SEC);
      pipe.sadd(chKey, member.id);
      pipe.expire(chKey, MEMBER_TTL_SEC + 30);
      pipe.sadd(gKey, channelId);
      pipe.expire(gKey, MEMBER_TTL_SEC + 60);
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
    let guildSet = this.memoryGuildChannels.get(guildId);
    if (!guildSet) {
      guildSet = new Set();
      this.memoryGuildChannels.set(guildId, guildSet);
    }
    guildSet.add(channelId);
  }

  private async removeMember(guildId: string, channelId: string, userId: string) {
    const chKey = this.channelKey(guildId, channelId);
    const mKey = this.memberKey(guildId, channelId, userId);
    const uKey = this.userIndexKey(userId);
    const loc = `${guildId}/${channelId}`;

    if (this.redis?.status === 'ready') {
      const gKey = this.guildChannelsKey(guildId);
      const pipe = this.redis.pipeline();
      pipe.del(mKey);
      pipe.srem(chKey, userId);
      pipe.srem(uKey, loc);
      await pipe.exec();
      const remaining = await this.redis.scard(chKey);
      if (remaining === 0) {
        await this.redis.srem(gKey, channelId);
      }
      return;
    }

    const map = this.memory.get(chKey);
    map?.delete(userId);
    if (map && map.size === 0) {
      this.memory.delete(chKey);
      const guildSet = this.memoryGuildChannels.get(guildId);
      guildSet?.delete(channelId);
      if (guildSet?.size === 0) this.memoryGuildChannels.delete(guildId);
    }
  }
}
