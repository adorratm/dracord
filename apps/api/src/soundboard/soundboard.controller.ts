import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { SoundboardService } from './soundboard.service';

@Controller('guilds/:guildId/sounds')
@UseGuards(JwtAuthGuard)
export class SoundboardController {
  constructor(private readonly sounds: SoundboardService) {}

  @Get()
  list(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.sounds.list(guildId, user.sub);
  }

  @Post()
  create(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: { name: string; emoji?: string | null; url: string; contentType: string; durationSec: number; volume?: number },
  ) {
    return this.sounds.create(guildId, user.sub, body ?? ({} as never));
  }

  @Patch(':soundId')
  update(
    @Param('guildId') guildId: string,
    @Param('soundId') soundId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { name?: string; emoji?: string | null; volume?: number },
  ) {
    return this.sounds.update(guildId, soundId, user.sub, body ?? {});
  }

  @Delete(':soundId')
  remove(
    @Param('guildId') guildId: string,
    @Param('soundId') soundId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.sounds.remove(guildId, soundId, user.sub);
  }
}
