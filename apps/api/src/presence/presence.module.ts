import { Module } from '@nestjs/common';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { UserActivityService } from './user-activity.service';

@Module({
  imports: [SocketBroadcastModule],
  controllers: [PresenceController],
  providers: [PresenceService, UserActivityService],
  exports: [PresenceService, UserActivityService],
})
export class PresenceModule {}