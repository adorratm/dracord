import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService, type UpdateProfileInput } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('friends')
  friends(@Req() req: { user: { sub: string } }) {
    return this.usersService.listFriends(req.user.sub);
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.usersService.search(q);
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
