import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Module,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ActivitySyncMetricsService } from '@/activities/activity-sync-metrics.service';
import { GatewayMetricsService } from '@/gateway/gateway-metrics.service';
import { SocketAdapterStateService } from '@/gateway/socket-adapter-state.service';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';

@Controller('health')
class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly adapterState: SocketAdapterStateService,
    private readonly activitySync: ActivitySyncMetricsService,
    private readonly gatewayMetrics: GatewayMetricsService,
  ) {}

  /** Liveness — süreç ayakta mı */
  @Get()
  live() {
    return { ok: true, service: 'dracord-api' };
  }

  /** Readiness — trafik almaya hazır mı */
  @Get('ready')
  async ready() {
    const redisRequired =
      this.config.get<string>('SOCKET_REDIS_REQUIRED') === 'true';
    const adapter = this.adapterState.snapshot();
    try {
      if (!this.dataSource.isInitialized) {
        throw new Error('db not initialized');
      }
      await this.dataSource.query('SELECT 1');
      if (redisRequired && !adapter.redisAdapter) {
        throw new HttpException(
          {
            ok: false,
            db: 'up',
            redisAdapter: false,
            error: adapter.error ?? 'Socket.IO Redis adapter yok',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      return {
        ok: true,
        db: 'up',
        redisAdapter: adapter.redisAdapter,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException({ ok: false, db: 'down' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /** Oyun sync sayaçları + Redis adapter durumu (auth yok — ops metrik) */
  @Get('activity-sync')
  activitySyncHealth() {
    return {
      ok: true,
      ...this.activitySync.snapshot(),
      socket: this.adapterState.snapshot(),
      flags: {
        activityCas: this.config.get<string>('ACTIVITY_CAS') === 'true',
        billiardsAuthority:
          this.config.get<string>('ACTIVITY_BILLIARDS_AUTHORITY') === 'true',
        socketRedisRequired:
          this.config.get<string>('SOCKET_REDIS_REQUIRED') === 'true',
      },
    };
  }

  /** Gateway / presence / voice orphan sayaçları */
  @Get('gateway')
  gatewayHealth() {
    return {
      ok: true,
      ...this.gatewayMetrics.snapshot(),
      socket: this.adapterState.snapshot(),
      offlineGraceMs: 25_000,
      voiceOrphanGraceMs: 90_000,
    };
  }
}

/** İstemci sürümleri — mağaza / OTA prompt (auth gerekmez) */
@Controller('client')
class ClientVersionsController {
  @Get('versions')
  versions() {
    const env = process.env;
    return {
      android: env.CLIENT_VERSION_ANDROID?.trim() || '0.1.0',
      ios: env.CLIENT_VERSION_IOS?.trim() || '0.1.0',
      desktop: env.CLIENT_VERSION_DESKTOP?.trim() || '0.1.0',
      minAndroid: env.CLIENT_MIN_VERSION_ANDROID?.trim() || null,
      minIos: env.CLIENT_MIN_VERSION_IOS?.trim() || null,
      storeUrlAndroid:
        env.CLIENT_STORE_URL_ANDROID?.trim() ||
        'https://play.google.com/store/apps/details?id=com.dracord.mobile',
      storeUrlIos: env.CLIENT_STORE_URL_IOS?.trim() || null,
    };
  }
}

@Module({
  imports: [SocketBroadcastModule],
  controllers: [HealthController, ClientVersionsController],
})
export class HealthModule {}
