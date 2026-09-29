import { Module } from '@nestjs/common';
import { SearchModule } from '@/search/search.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SearchModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
