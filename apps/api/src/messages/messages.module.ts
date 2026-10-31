import { Module, forwardRef } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { ModerationModule } from '@/moderation/moderation.module';
import { MusicModule } from '@/music/music.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { QueuesModule } from '@/queues/queues.module';
import { SearchModule } from '@/search/search.module';
import { LinkPreviewService } from './link-preview.service';
import { CustomSlashService } from './custom-slash.service';
import { MessagesController } from './messages.controller';
import { MessagesRealtimeService } from './messages-realtime.service';
import { MessagesService } from './messages.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';

@Module({
  imports: [
    ChannelsModule,
    GuildsModule,
    ModerationModule,
    SearchModule,
    NotificationsModule,
    QueuesModule,
    forwardRef(() => MusicModule),
  ],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    LinkPreviewService,
    MessagesRealtimeService,
    CustomSlashService,
    ReminderSchedulerService,
  ],
  exports: [MessagesService, MessagesRealtimeService],
})
export class MessagesModule {}