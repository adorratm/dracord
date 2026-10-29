import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import {
  FunnelMetricsService,
  type FunnelEvent,
} from './funnel-metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly funnel: FunnelMetricsService) {}

  @Post('metrics/funnel')
  @UseGuards(JwtAuthGuard)
  track(
    @Req() req: { user: { sub: string } },
    @Body() body: { event?: string; meta?: Record<string, string> },
  ) {
    const event = (body?.event || 'unknown') as FunnelEvent;
    this.funnel.record(event, {
      ...(body?.meta ?? {}),
      userId: req.user.sub,
    });
    return { ok: true };
  }

  @Get('health/funnel')
  health() {
    return { ok: true, ...this.funnel.snapshot() };
  }
}
