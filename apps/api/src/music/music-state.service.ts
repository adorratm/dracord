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

  emptyState(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string,
  ): MusicQueueState {
    return {
      guildId,
      voiceChannelId,
      textChannelId,
      nowPlaying: null,
      queue: [],
      paused: false,
      volume: 80,
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
    if (this.redis?.status === 'ready') {
      await this.redis.set(k, JSON.stringify(state));
      return;
    }
    this.memory.set(k, state);
  }

  async clear(guildId: string, voiceChannelId: string): Promise<void> {
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
