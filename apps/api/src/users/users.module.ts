import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/notifications/notifications.module';
import { SearchModule } from '@/search/search.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccountDataService } from './account-data.service';

@Module({
  imports: [
    SearchModule,
    NotificationsModule,
    VoicePresenceModule,
    SocketBroadcastModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, AccountDataService],
  exports: [UsersService, AccountDataService],
})
export class UsersModule {}
