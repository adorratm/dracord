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

  @Get('blocked')
  blocked(@Req() req: { user: { sub: string } }) {
    return this.usersService.listBlocked(req.user.sub);
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
