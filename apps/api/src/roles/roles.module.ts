import { Module } from '@nestjs/common';
import { GuildsModule } from '../guilds/guilds.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [GuildsModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
