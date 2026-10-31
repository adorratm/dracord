import { Module, forwardRef } from '@nestjs/common';
import { PresenceModule } from '@/presence/presence.module';
import { QueuesModule } from '@/queues/queues.module';
import { SpotifyController } from './spotify.controller';
import { SpotifyService } from './spotify.service';

@Module({
  imports: [forwardRef(() => PresenceModule), QueuesModule],
  controllers: [SpotifyController],
  providers: [SpotifyService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
