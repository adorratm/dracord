import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { GuildFaqConfigDto } from '@dracord/types';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { GuildsService } from '@/guilds/guilds.service';
import { DracoService } from './draco.service';

@Controller('guilds/:guildId/faq')
@UseGuards(JwtAuthGuard)
export class DracoController {
  constructor(
    private readonly draco: DracoService,
    private readonly guilds: GuildsService,
  ) {}

  @Get()
  async get(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    await this.guilds.ensureMember(guildId, user.sub);
    return this.draco.getConfig(guildId);
  }

  @Patch()
  update(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser, @Body() body: Partial<Omit<GuildFaqConfigDto, 'guildId'>>) {
    return this.draco.updateConfig(guildId, user.sub, body ?? {});
  }
}
