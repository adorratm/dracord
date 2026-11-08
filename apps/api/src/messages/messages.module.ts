import { Module, forwardRef } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { LevelsModule } from '@/levels/levels.module';
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
import { ScheduledMessagesController } from './scheduled-messages.controller';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { CatchupService } from './catchup.service';

@Module({
  imports: [
    ChannelsModule,
    GuildsModule,
    ModerationModule,
    SearchModule,
    NotificationsModule,
    QueuesModule,
    LevelsModule,
    forwardRef(() => MusicModule),
  ],
  controllers: [MessagesController, ScheduledMessagesController],
  providers: [
    MessagesService,
    LinkPreviewService,
    MessagesRealtimeService,
    CustomSlashService,
    ReminderSchedulerService,
    ScheduledMessagesService,
    CatchupService,
  ],
  exports: [MessagesService, MessagesRealtimeService, ScheduledMessagesService],
})
export class MessagesModule {}