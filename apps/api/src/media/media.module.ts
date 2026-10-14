import { Module } from '@nestjs/common';
import { DealerTtsController } from './dealer-tts.controller';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController, DealerTtsController],
  providers: [MediaService],
})
export class MediaModule {}
