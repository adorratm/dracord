import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ModerationModule } from '@/moderation/moderation.module';
import { PlatformModule } from '@/platform/platform.module';
import { SearchModule } from '@/search/search.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { MusicConfigService } from './music-config.service';
import { ClientErrorsModule } from '@/client-errors/client-errors.module';

@Module({
  imports: [
    AuthModule,
    VoicePresenceModule,
    SearchModule,
    ModerationModule,
    PlatformModule,
    ClientErrorsModule,
  ],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService, PlatformAdminGuard, MusicConfigService],
})
export class PlatformAdminModule {}
