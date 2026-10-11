import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { GuildEventsService } from './guild-events.service';

@Controller('guilds/:guildId/events')
@UseGuards(JwtAuthGuard)
export class GuildEventsController {
  constructor(private readonly events: GuildEventsService) {}

  @Get()
  list(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.events.list(guildId, user.sub);
  }

  @Post()
  create(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      title: string;
      description?: string | null;
      startsAt: string;
      endsAt?: string | null;
      location?: string | null;
      coverUrl?: string | null;
      channelId?: string | null;
    },
  ) {
    return this.events.create(guildId, user.sub, body);
  }

  @Patch(':eventId')
  update(
    @Param('guildId') guildId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      startsAt?: string;
      endsAt?: string | null;
      location?: string | null;
      coverUrl?: string | null;
      channelId?: string | null;
      status?: 'scheduled' | 'cancelled' | 'ended';
    },
  ) {
    return this.events.update(guildId, eventId, user.sub, body);
  }

  @Delete(':eventId')
  async remove(
    @Param('guildId') guildId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    await this.events.remove(guildId, eventId, user.sub);
    return { ok: true };
  }
}
