import { Module, forwardRef } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { MusicModule } from '@/music/music.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { SearchModule } from '@/search/search.module';
import { LinkPreviewService } from './link-preview.service';
import { MessagesController } from './messages.controller';
import { MessagesRealtimeService } from './messages-realtime.service';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    ChannelsModule,
    GuildsModule,
    SearchModule,
    NotificationsModule,
    forwardRef(() => MusicModule),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, LinkPreviewService, MessagesRealtimeService],
  exports: [MessagesService, MessagesRealtimeService],
})
export class MessagesModule {}
