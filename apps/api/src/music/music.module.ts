import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { GuildsModule } from '@/guilds/guilds.module';
import { MessagesModule } from '@/messages/messages.module';
import { QueuesModule } from '@/queues/queues.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { MUSIC_QUEUE } from './music.constants';
import { MusicCommandsService } from './music-commands.service';
import { MusicController } from './music.controller';
import { MusicInternalController } from './music-internal.controller';
import { MusicJobsService } from './music-jobs.service';
import { MusicResolveService } from './music-resolve.service';
import { MusicStateService } from './music-state.service';

@Module({
  imports: [
    QueuesModule,
    BullModule.registerQueue({ name: MUSIC_QUEUE }),
    VoicePresenceModule,
    GuildsModule,
    forwardRef(() => MessagesModule),
  ],
  controllers: [MusicInternalController, MusicController],
  providers: [
    MusicStateService,
    MusicResolveService,
    MusicJobsService,
    MusicCommandsService,
  ],
  exports: [MusicCommandsService, MusicStateService, MusicJobsService],
})
export class MusicModule {}
