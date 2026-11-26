import { Module } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { RolesModule } from '@/roles/roles.module';
import { GuildBackupController } from './guild-backup.controller';
import { GuildBackupService } from './guild-backup.service';

@Module({
  imports: [GuildsModule, ChannelsModule, RolesModule],
  controllers: [GuildBackupController],
  providers: [GuildBackupService],
})
export class GuildBackupModule {}
