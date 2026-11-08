import { Module } from '@nestjs/common';
import { GuildsModule } from '@/guilds/guilds.module';
import { UploadsModule } from '@/uploads/uploads.module';
import { SoundboardController } from './soundboard.controller';
import { SoundboardService } from './soundboard.service';

@Module({
  imports: [GuildsModule, UploadsModule],
  controllers: [SoundboardController],
  providers: [SoundboardService],
  exports: [SoundboardService],
})
export class SoundboardModule {}
