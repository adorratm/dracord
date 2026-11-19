import { Module } from '@nestjs/common';
import { GuildsModule } from '@/guilds/guilds.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { OnboardingModule } from '@/onboarding/onboarding.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [GuildsModule, NotificationsModule, OnboardingModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
