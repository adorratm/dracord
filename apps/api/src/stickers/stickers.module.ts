import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { StickersController } from './stickers.controller';
import { StickersService } from './stickers.service';

@Module({
  imports: [AuthModule],
  controllers: [StickersController],
  providers: [StickersService],
})
export class StickersModule {}
