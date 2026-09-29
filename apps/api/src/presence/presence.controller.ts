import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdatePresenceDto } from './dto/update-presence.dto';
import { PresenceService } from './presence.service';

@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayloadUser) {
    return this.presenceService.getStatus(user.sub);
  }

  @Patch('me')
  update(@CurrentUser() user: JwtPayloadUser, @Body() dto: UpdatePresenceDto) {
    return this.presenceService.updateStatus(user.sub, dto.status);
  }
}
