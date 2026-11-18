import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { MessagesModule } from '@/messages/messages.module';
import { OnboardingModule } from '@/onboarding/onboarding.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [GuildsModule, SocketBroadcastModule, MessagesModule, BotModule, OnboardingModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
