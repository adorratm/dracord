import { Module } from '@nestjs/common';
import { QueuesModule } from '@/queues/queues.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsRealtimeService } from './notifications-realtime.service';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@Module({
  imports: [QueuesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRealtimeService, PushService],
  exports: [NotificationsService, NotificationsRealtimeService, PushService],
})
export class NotificationsModule {}
