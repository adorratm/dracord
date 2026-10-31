import { Module } from '@nestjs/common';
import { PlatformModule } from '@/platform/platform.module';
import { OpenApiController } from './openapi.controller';
import { WellKnownController } from './well-known.controller';

@Module({
  imports: [PlatformModule],
  controllers: [WellKnownController, OpenApiController],
})
export class DiscoveryModule {}
