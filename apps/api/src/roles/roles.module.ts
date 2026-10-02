import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [AuthModule, GuildsModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
