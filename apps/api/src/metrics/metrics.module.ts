import { Global, Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { FunnelMetricsService } from './funnel-metrics.service';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [MetricsController],
  providers: [FunnelMetricsService],
  exports: [FunnelMetricsService],
})
export class MetricsModule {}
