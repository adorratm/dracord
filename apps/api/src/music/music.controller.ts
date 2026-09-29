import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { MusicQueueState } from '@dracord/types';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { GuildsService } from '@/guilds/guilds.service';
import { MusicJobsService } from './music-jobs.service';
import { MusicStateService } from './music-state.service';

@Controller('music')
@UseGuards(JwtAuthGuard)
export class MusicController {
  constructor(
    private readonly state: MusicStateService,
    private readonly jobs: MusicJobsService,
    private readonly guilds: GuildsService,
  ) {}

  private async assertGuildMember(guildId: string, userId: string) {
    const list = await this.guilds.listForUser(userId);
    if (!list.some((g) => g.id === guildId)) {
      throw new ForbiddenException('Bu sunucuya üye değilsin');
    }
  }

  @Get('state')
  async getState(
    @CurrentUser() user: JwtPayloadUser,
    @Query('guildId') guildId: string,
    @Query('voiceChannelId') voiceChannelId: string,
  ): Promise<MusicQueueState | { empty: true }> {
    if (!guildId || !voiceChannelId) return { empty: true };
    await this.assertGuildMember(guildId, user.sub);
    const s = await this.state.get(guildId, voiceChannelId);
    return s ?? { empty: true };
  }

  @Post('control')
  async control(
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      guildId: string;
      voiceChannelId: string;
      textChannelId?: string;
      action: 'pause' | 'resume' | 'skip' | 'stop' | 'volume';
      volume?: number;
    },
  ) {
    await this.assertGuildMember(body.guildId, user.sub);
    let state = await this.state.get(body.guildId, body.voiceChannelId);
    const textChannelId = body.textChannelId || state?.textChannelId;

    switch (body.action) {
      case 'pause':
        if (!state?.nowPlaying) return { ok: false, reason: 'empty' };
        state.paused = true;
        await this.state.save(state);
        await this.jobs.enqueue({
          type: 'pause',
          guildId: body.guildId,
          voiceChannelId: body.voiceChannelId,
          textChannelId,
        });
        break;
      case 'resume':
        if (!state?.nowPlaying) return { ok: false, reason: 'empty' };
        state.paused = false;
        await this.state.save(state);
        await this.jobs.enqueue({
          type: 'resume',
          guildId: body.guildId,
          voiceChannelId: body.voiceChannelId,
          textChannelId,
        });
        break;
      case 'skip':
        if (!state?.nowPlaying) return { ok: false, reason: 'empty' };
        await this.jobs.enqueue({
          type: 'skip',
          guildId: body.guildId,
          voiceChannelId: body.voiceChannelId,
          textChannelId,
        });
        break;
      case 'stop':
        await this.state.clear(body.guildId, body.voiceChannelId);
        await this.jobs.enqueue({
          type: 'stop',
          guildId: body.guildId,
          voiceChannelId: body.voiceChannelId,
          textChannelId,
        });
        break;
      case 'volume': {
        const n = Number(body.volume);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return { ok: false, reason: 'bad_volume' };
        }
        state =
          state ??
          this.state.emptyState(
            body.guildId,
            body.voiceChannelId,
            textChannelId || body.voiceChannelId,
          );
        state.volume = Math.round(n);
        if (textChannelId) state.textChannelId = textChannelId;
        await this.state.save(state);
        await this.jobs.enqueue({
          type: 'set_volume',
          guildId: body.guildId,
          voiceChannelId: body.voiceChannelId,
          textChannelId,
          volume: state.volume,
        });
        break;
      }
      default:
        return { ok: false, reason: 'unknown' };
    }
    return {
      ok: true,
      state: (await this.state.get(body.guildId, body.voiceChannelId)) ?? null,
    };
  }
}
