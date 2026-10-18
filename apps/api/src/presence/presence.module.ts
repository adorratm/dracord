import { Module, forwardRef } from '@nestjs/common';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { SpotifyModule } from '@/spotify/spotify.module';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { UserActivityService } from './user-activity.service';

@Module({
  imports: [SocketBroadcastModule, forwardRef(() => SpotifyModule)],
  controllers: [PresenceController],
  providers: [PresenceService, UserActivityService],
  exports: [PresenceService, UserActivityService],
})
export class PresenceModule {}