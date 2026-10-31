import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Bellek yedek (Redis yokken / hata) */
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * Bot / platform rate limit — Redis fixed window; yoksa bellek.
 * Env: REDIS_URL, PLATFORM_RATE_LIMIT (varsayılan 60), PLATFORM_RATE_WINDOW_MS
 */
@Injectable()
export class PlatformRateLimitService implements OnModuleDestroy {
  private readonly log = new Logger(PlatformRateLimitService.name);
  private redis: Redis | null = null;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(private readonly config: ConfigService) {
    this.limit = Number(this.config.get<string>('PLATFORM_RATE_LIMIT') ?? 60);
    this.windowMs = Number(
      this.config.get<string>('PLATFORM_RATE_WINDOW_MS') ?? 60_000,
    );
    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      void this.redis.connect().catch((err: Error) => {
        this.log.warn(`Redis rate-limit bağlanamadı: ${err.message}`);
      });
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
      this.redis = null;
    }
  }

  async consume(
    key: string,
    limit = this.limit,
    windowMs = this.windowMs,
  ): Promise<RateLimitResult> {
    if (this.redis?.status === 'ready') {
      try {
        return await this.consumeRedis(key, limit, windowMs);
      } catch (err) {
        this.log.debug(
          `Redis RL fail → memory: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return this.consumeMemory(key, limit, windowMs);
  }

  private async consumeRedis(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const redisKey = `rl:platform:${key}`;
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    const count = await this.redis!.incr(redisKey);
    if (count === 1) {
      await this.redis!.expire(redisKey, windowSec);
    }
    if (count > limit) {
      const ttl = await this.redis!.ttl(redisKey);
      return {
        ok: false,
        retryAfterSec: ttl > 0 ? ttl : windowSec,
      };
    }
    return { ok: true };
  }

  private consumeMemory(
    key: string,
    limit: number,
    windowMs: number,
  ): RateLimitResult {
    const now = Date.now();
    let b = memoryBuckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      memoryBuckets.set(key, b);
    }
    b.count += 1;
    if (b.count > limit) {
      return {
        ok: false,
        retryAfterSec: Math.ceil((b.resetAt - now) / 1000),
      };
    }
    return { ok: true };
  }
}

/** @deprecated Prefer PlatformRateLimitService — senkron bellek yedek */
export function platformRateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  let b = memoryBuckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true };
}
