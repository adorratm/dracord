import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { SearchModule } from '@/search/search.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { GuildsController, InvitesController } from './guilds.controller';
import { GuildsService } from './guilds.service';

@Module({
  imports: [
    SearchModule,
    BotModule,
    VoicePresenceModule,
    SocketBroadcastModule,
  ],
  controllers: [GuildsController, InvitesController],
  providers: [GuildsService],
  exports: [GuildsService],
})
export class GuildsModule {}
