import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { MessagesModule } from '@/messages/messages.module';
import { QueuesModule } from '@/queues/queues.module';
import { BotAuthGuard } from './bot-auth.guard';
import { BotGatewayGateway } from './bot-gateway.gateway';
import { BotGatewayService } from './bot-gateway.service';
import { MusicPlatformBootstrapService } from './music-platform-bootstrap.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformController } from './platform.controller';
import { PlatformRateLimitService } from './platform-rate-limit.service';
import { PlatformService } from './platform.service';

@Module({
  imports: [AuthModule, MessagesModule, QueuesModule],
  controllers: [PlatformController],
  providers: [
    PlatformService,
    BotAuthGuard,
    BotGatewayService,
    BotGatewayGateway,
    PlatformRateLimitService,
    PlatformAuditService,
    MusicPlatformBootstrapService,
  ],
  exports: [
    PlatformService,
    BotGatewayService,
    PlatformRateLimitService,
    PlatformAuditService,
  ],
})
export class PlatformModule {}
