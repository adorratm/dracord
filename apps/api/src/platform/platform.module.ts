import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { MessagesModule } from '@/messages/messages.module';
import { BotAuthGuard } from './bot-auth.guard';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [AuthModule, MessagesModule],
  controllers: [PlatformController],
  providers: [PlatformService, BotAuthGuard],
  exports: [PlatformService],
})
export class PlatformModule {}
