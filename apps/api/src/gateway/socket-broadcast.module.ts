import { Global, Module } from '@nestjs/common';
import { ActivitySyncMetricsService } from '@/activities/activity-sync-metrics.service';
import { GatewayMetricsService } from './gateway-metrics.service';
import { SocketAdapterStateService } from './socket-adapter-state.service';
import { SocketBroadcastService } from './socket-broadcast.service';

/** ChatGateway’den bağımsız; dairesel Nest/webpack import’larını önler. */
@Global()
@Module({
  providers: [
    SocketBroadcastService,
    SocketAdapterStateService,
    ActivitySyncMetricsService,
    GatewayMetricsService,
  ],
  exports: [
    SocketBroadcastService,
    SocketAdapterStateService,
    ActivitySyncMetricsService,
    GatewayMetricsService,
  ],
})
export class SocketBroadcastModule {}