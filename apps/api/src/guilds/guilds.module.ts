import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { BotModule } from '@/bot/bot.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { ModerationModule } from '@/moderation/moderation.module';
import { QueuesModule } from '@/queues/queues.module';
import { SearchModule } from '@/search/search.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { EveryoneRoleBootstrapService } from './everyone-role-bootstrap.service';
import { GuildsController, InvitesController, PublicGuildsController } from './guilds.controller';
import { GuildsService } from './guilds.service';

@Module({
  imports: [
    AuthModule,
    SearchModule,
    BotModule,
    VoicePresenceModule,
    SocketBroadcastModule,
    ModerationModule,
    QueuesModule,
  ],
  controllers: [GuildsController, InvitesController, PublicGuildsController],
  providers: [GuildsService, EveryoneRoleBootstrapService],
  exports: [GuildsService],
})
export class GuildsModule {}
