import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/notifications/notifications.module';
import { SearchModule } from '@/search/search.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SearchModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
