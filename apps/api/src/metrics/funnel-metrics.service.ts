import { Injectable } from '@nestjs/common';

export type FunnelEvent =
  | 'invite_accept'
  | 'onboarding_complete'
  | 'guild_create'
  | 'discover_join'
  | 'nitro_checkout'
  | 'template_create';

@Injectable()
export class FunnelMetricsService {
  private counts = new Map<string, number>();
  private last: Array<{ event: string; at: string; meta?: Record<string, string> }> =
    [];

  record(event: FunnelEvent | string, meta?: Record<string, string>) {
    this.counts.set(event, (this.counts.get(event) ?? 0) + 1);
    this.last.unshift({
      event,
      at: new Date().toISOString(),
      meta,
    });
    this.last = this.last.slice(0, 50);
  }

  snapshot() {
    return {
      counts: Object.fromEntries(this.counts),
      recent: this.last,
    };
  }
}
