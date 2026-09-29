import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesService } from './roles.service';

@Controller('guilds/:guildId/roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.rolesService.listGuildRoles(guildId, user.sub);
  }
}
