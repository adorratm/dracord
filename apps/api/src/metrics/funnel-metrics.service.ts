import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FunnelEventRow } from '@/database/entities/funnel-event.entity';

export type FunnelEvent =
  | 'invite_accept'
  | 'onboarding_complete'
  | 'guild_create'
  | 'discover_join'
  | 'nitro_checkout'
  | 'template_create';

@Injectable()
export class FunnelMetricsService implements OnModuleInit {
  private readonly log = new Logger(FunnelMetricsService.name);
  private counts = new Map<string, number>();
  private last: Array<{
    event: string;
    at: string;
    meta?: Record<string, string>;
  }> = [];

  constructor(private readonly em: EntityManager) {}

  async onModuleInit() {
    try {
      const rows = await this.em
        .createQueryBuilder(FunnelEventRow, 'f')
        .select('f.event', 'event')
        .addSelect('COUNT(*)', 'cnt')
        .groupBy('f.event')
        .getRawMany<{ event: string; cnt: string }>();
      for (const r of rows) {
        this.counts.set(r.event, Number(r.cnt) || 0);
      }
      const recent = await this.em.find(FunnelEventRow, {
        order: { createdAt: 'DESC' },
        take: 50,
      });
      this.last = recent.map((r) => ({
        event: r.event,
        at: r.createdAt.toISOString(),
        meta: r.meta ?? undefined,
      }));
    } catch (err) {
      this.log.debug(
        `funnel hydrate skip: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  record(
    event: FunnelEvent | string,
    meta?: Record<string, string>,
    userId?: string | null,
  ) {
    const key = String(event).slice(0, 64);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    this.last.unshift({
      event: key,
      at: new Date().toISOString(),
      meta,
    });
    this.last = this.last.slice(0, 50);
    void this.persist(key, meta, userId).catch((err: Error) => {
      this.log.debug(`funnel persist: ${err.message}`);
    });
  }

  private async persist(
    event: string,
    meta?: Record<string, string>,
    userId?: string | null,
  ) {
    const row = this.em.create(FunnelEventRow, {
      event,
      meta: meta ?? null,
      userId: userId ?? null,
    });
    await this.em.save(FunnelEventRow, row);
  }

  snapshot() {
    return {
      counts: Object.fromEntries(this.counts),
      recent: this.last,
      persistent: true,
    };
  }
}
