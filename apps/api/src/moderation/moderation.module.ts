import { Module } from '@nestjs/common';
import { QueuesModule } from '@/queues/queues.module';
import { AutomodService } from './automod.service';
import { ContentHashService } from './content-hash.service';
import { ContentScanService } from './content-scan.service';
import { GuildSafetyService } from './guild-safety.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [QueuesModule],
  controllers: [ReportsController],
  providers: [
    AutomodService,
    GuildSafetyService,
    ContentHashService,
    ContentScanService,
  ],
  exports: [
    AutomodService,
    GuildSafetyService,
    ContentHashService,
    ContentScanService,
  ],
})
export class ModerationModule {}
