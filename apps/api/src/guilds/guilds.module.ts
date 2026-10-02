import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { BotModule } from '@/bot/bot.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { SearchModule } from '@/search/search.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { EveryoneRoleBootstrapService } from './everyone-role-bootstrap.service';
import { GuildsController, InvitesController } from './guilds.controller';
import { GuildsService } from './guilds.service';

@Module({
  imports: [
    AuthModule,
    SearchModule,
    BotModule,
    VoicePresenceModule,
    SocketBroadcastModule,
  ],
  controllers: [GuildsController, InvitesController],
  providers: [GuildsService, EveryoneRoleBootstrapService],
  exports: [GuildsService],
})
export class GuildsModule {}
