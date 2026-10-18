import { Module, forwardRef } from '@nestjs/common';
import { PresenceModule } from '@/presence/presence.module';
import { SpotifyController } from './spotify.controller';
import { SpotifyService } from './spotify.service';

@Module({
  imports: [forwardRef(() => PresenceModule)],
  controllers: [SpotifyController],
  providers: [SpotifyService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
