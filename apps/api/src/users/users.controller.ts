import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { UsersService, type UpdateProfileInput } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('friends')
  friends(@Req() req: { user: { sub: string } }) {
    return this.usersService.listFriends(req.user.sub);
  }

  @Get('friends/pending')
  pendingFriends(@Req() req: { user: { sub: string } }) {
    return this.usersService.listPendingFriends(req.user.sub);
  }

  @Get('blocked')
  blocked(@Req() req: { user: { sub: string } }) {
    return this.usersService.listBlocked(req.user.sub);
  }

  @Post(':id/friend-request')
  sendFriendRequest(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.usersService.sendFriendRequest(req.user.sub, id);
  }

  @Post(':id/friend-request/accept')
  acceptFriendRequest(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.usersService.acceptFriendRequest(req.user.sub, id);
  }

  @Delete(':id/friend-request')
  declineFriendRequest(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.usersService.declineFriendRequest(req.user.sub, id);
  }

  @Post(':id/block')
  block(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.usersService.blockUser(req.user.sub, id);
  }

  @Delete(':id/block')
  unblock(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.usersService.unblockUser(req.user.sub, id);
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.usersService.search(q);
  }

  @Get('username/available')
  async usernameAvailable(
    @Query('username') username = '',
    @Req() req: { user: { sub: string } },
  ) {
    const available = await this.usersService.isUsernameAvailable(
      username,
      req.user.sub,
    );
    const normalized = this.usersService.normalizeUsername(username);
    return { username: normalized, available };
  }

  @Post('me/username')
  confirmUsername(
    @Req() req: { user: { sub: string } },
    @Body() body: { username?: string },
  ) {
    return this.usersService.confirmUsername(req.user.sub, body.username ?? '');
  }

  @Patch('me')
  updateMe(@Req() req: { user: { sub: string } }, @Body() body: UpdateProfileInput) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Get('me/settings')
  getSettings(@Req() req: { user: { sub: string } }) {
    return this.usersService.getClientSettings(req.user.sub);
  }

  @Patch('me/settings')
  updateSettings(
    @Req() req: { user: { sub: string } },
    @Body() body: Record<string, unknown>,
  ) {
    return this.usersService.updateClientSettings(req.user.sub, body as never);
  }

  @Post('me/password')
  changePassword(
    @Req() req: { user: { sub: string } },
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    return this.usersService.changePassword(
      req.user.sub,
      body.currentPassword ?? '',
      body.newPassword ?? '',
    );
  }

  @Post('me/deactivate')
  deactivate(
    @Req() req: { user: { sub: string } },
    @Body() body: { password?: string },
  ) {
    return this.usersService.deactivateAccount(req.user.sub, body.password);
  }

  @Post('me/reactivate')
  reactivate(@Req() req: { user: { sub: string } }) {
    return this.usersService.reactivateAccount(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.usersService.findById(id, req.user.sub);
  }
}
