import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '@/auth/auth.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { GamesController, GamesPublicController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [JwtModule.register({}), AuthModule, GuildsModule, NotificationsModule, VoicePresenceModule],
  controllers: [GamesController, GamesPublicController],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {}
