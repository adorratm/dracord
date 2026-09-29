import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsRealtimeService } from './notifications-realtime.service';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRealtimeService],
  exports: [NotificationsService, NotificationsRealtimeService],
})
export class NotificationsModule {}
