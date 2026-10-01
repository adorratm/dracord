import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsRealtimeService } from './notifications-realtime.service';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRealtimeService, PushService],
  exports: [NotificationsService, NotificationsRealtimeService, PushService],
})
export class NotificationsModule {}
