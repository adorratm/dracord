import { Controller, Get, HttpException, HttpStatus, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  /** Liveness — süreç ayakta mı */
  @Get()
  live() {
    return { ok: true, service: 'dracord-api' };
  }

  /** Readiness — trafik almaya hazır mı */
  @Get('ready')
  async ready() {
    try {
      if (!this.dataSource.isInitialized) {
        throw new Error('db not initialized');
      }
      await this.dataSource.query('SELECT 1');
      return { ok: true, db: 'up' };
    } catch {
      throw new HttpException({ ok: false, db: 'down' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
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
  controllers: [HealthController, ClientVersionsController],
})
export class HealthModule {}
