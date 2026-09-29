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

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
