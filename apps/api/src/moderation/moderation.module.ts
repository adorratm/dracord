import { Global, Module } from '@nestjs/common';
import { AutomodService } from './automod.service';

@Global()
@Module({
  providers: [AutomodService],
  exports: [AutomodService],
})
export class ModerationModule {}
