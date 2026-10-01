import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MusicQueueState, MusicTrack } from '@dracord/types';
import { createId } from '@paralleldrive/cuid2';
import Redis from 'ioredis';

@Injectable()
export class MusicStateService implements OnModuleDestroy {
  private readonly logger = new Logger(MusicStateService.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, MusicQueueState>();
  private readonly volumeMemory = new Map<string, number>();

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      void this.redis.connect().catch((err: Error) => {
        this.logger.warn(`Music state Redis unavailable: ${err.message}`);
      });
    } else {
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  private key(guildId: string, voiceChannelId: string) {
    return `music:state:${guildId}:${voiceChannelId}`;
  }

  private volumeKey(guildId: string, voiceChannelId: string) {
    return `music:volume:${guildId}:${voiceChannelId}`;
  }

  async getPersistedVolume(guildId: string, voiceChannelId: string): Promise<number> {
    const k = this.volumeKey(guildId, voiceChannelId);
    if (this.redis?.status === 'ready') {
      const raw = await this.redis.get(k);
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
      }
      return 80;
    }
    return this.volumeMemory.get(k) ?? 80;
  }

  async persistVolume(guildId: string, voiceChannelId: string, volume: number): Promise<void> {
    const v = Math.max(0, Math.min(100, Math.round(volume)));
    const k = this.volumeKey(guildId, voiceChannelId);
    if (this.redis?.status === 'ready') {
      await this.redis.set(k, String(v));
      return;
    }
    this.volumeMemory.set(k, v);
  }

  async emptyState(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string,
  ): Promise<MusicQueueState> {
    const volume = await this.getPersistedVolume(guildId, voiceChannelId);
    return {
      guildId,
      voiceChannelId,
      textChannelId,
      nowPlaying: null,
      queue: [],
      paused: false,
      volume,
    };
  }

  async get(guildId: string, voiceChannelId: string): Promise<MusicQueueState | null> {
    const k = this.key(guildId, voiceChannelId);
    if (this.redis?.status === 'ready') {
      const raw = await this.redis.get(k);
      if (!raw) return null;
      return JSON.parse(raw) as MusicQueueState;
    }
    return this.memory.get(k) ?? null;
  }

  async save(state: MusicQueueState): Promise<void> {
    const k = this.key(state.guildId, state.voiceChannelId);
    await this.persistVolume(state.guildId, state.voiceChannelId, state.volume);
    if (this.redis?.status === 'ready') {
      await this.redis.set(k, JSON.stringify(state));
      return;
    }
    this.memory.set(k, state);
  }

  async clear(guildId: string, voiceChannelId: string): Promise<void> {
    // Volume ayrı key’de kalır — stop/kuyruk bitince ses seviyesi unutulmaz
    const existing = await this.get(guildId, voiceChannelId);
    if (existing) {
      await this.persistVolume(guildId, voiceChannelId, existing.volume);
    }
    const k = this.key(guildId, voiceChannelId);
    if (this.redis?.status === 'ready') {
      await this.redis.del(k);
      return;
    }
    this.memory.delete(k);
  }

  makeTrack(partial: Omit<MusicTrack, 'id'> & { id?: string }): MusicTrack {
    return { id: partial.id ?? createId(), ...partial };
  }
}
