import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesService, type CreateRoleInput, type UpdateRoleInput } from './roles.service';

@Controller('guilds/:guildId/roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.rolesService.listGuildRoles(guildId, user.sub);
  }

  @Post()
  create(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: CreateRoleInput,
  ) {
    return this.rolesService.createRole(guildId, user.sub, body);
  }

  /** Üye rolleri — :roleId rotalarından önce */
  @Put('members/:userId')
  setMemberRoles(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { roleIds?: string[] },
  ) {
    return this.rolesService.setMemberRoles(
      guildId,
      userId,
      user.sub,
      body.roleIds ?? [],
    );
  }

  @Post('members/:userId/:roleId')
  addMemberRole(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.rolesService.addMemberRole(guildId, userId, user.sub, roleId);
  }

  @Delete('members/:userId/:roleId')
  removeMemberRole(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.rolesService.removeMemberRole(guildId, userId, user.sub, roleId);
  }

  @Patch(':roleId')
  update(
    @Param('guildId') guildId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: UpdateRoleInput,
  ) {
    return this.rolesService.updateRole(guildId, roleId, user.sub, body);
  }

  @Delete(':roleId')
  remove(
    @Param('guildId') guildId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.rolesService.deleteRole(guildId, roleId, user.sub);
  }
}
