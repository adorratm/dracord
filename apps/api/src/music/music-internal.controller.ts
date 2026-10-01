import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { EntityManager } from 'typeorm';
import { BotService } from '@/bot/bot.service';
import { Channel } from '@/database/entities/channel.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType } from '@/database/enums';
import { VoicePresenceService } from '@/voice/voice-presence.service';
import { MusicCommandsService } from './music-commands.service';
import { MusicJobsService } from './music-jobs.service';
import { MusicStateService } from './music-state.service';

@Controller('internal/music')
export class MusicInternalController {
  constructor(
    private readonly config: ConfigService,
    private readonly em: EntityManager,
    private readonly bot: BotService,
    private readonly presence: VoicePresenceService,
    private readonly state: MusicStateService,
    private readonly jobs: MusicJobsService,
    private readonly commands: MusicCommandsService,
  ) {}

  private assertSecret(secret?: string) {
    const expected = this.config.get<string>('MUSIC_BOT_INTERNAL_SECRET') ?? 'dracord-music-dev';
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid music bot secret');
    }
  }

  @Post('token')
  async token(
    @Headers('x-music-bot-secret') secret: string | undefined,
    @Body() body: { channelId: string },
  ) {
    this.assertSecret(secret);
    const botId = this.bot.getBotUserId();
    await this.bot.ensureBotUser();
    const channel = await this.em.findOneOrFail(Channel, { where: { id: body.channelId } });
    if (channel.type !== ChannelType.VOICE) {
      throw new UnauthorizedException('Not a voice channel');
    }
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    // Worker Docker içinde: host.docker.internal üzerinden ICE (node_ip 127.0.0.1 sorununu aşar)
    const url =
      this.config.get<string>('MUSIC_BOT_LIVEKIT_URL') ??
      this.config.get<string>('LIVEKIT_URL') ??
      this.config.get<string>('LIVEKIT_PUBLIC_URL') ??
      'ws://localhost:7880';
    if (!apiKey || !apiSecret) throw new UnauthorizedException('LiveKit not configured');

    const user = await this.em.findOneOrFail(User, { where: { id: botId } });
    const roomName = `dracord-voice-${body.channelId}`;
    const token = new AccessToken(apiKey, apiSecret, {
      identity: botId,
      name: user.displayName,
      metadata: JSON.stringify({
        avatarUrl: user.avatarUrl ?? null,
        username: user.username,
        isBot: true,
      }),
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });
    return { token: await token.toJwt(), url, roomName, botUserId: botId };
  }

  @Post('presence/join')
  async presenceJoin(
    @Headers('x-music-bot-secret') secret: string | undefined,
    @Body() body: { guildId: string; channelId: string },
  ) {
    this.assertSecret(secret);
    const botId = this.bot.getBotUserId();
    await this.bot.ensureBotUser();
    return this.presence.join(body.guildId, body.channelId, botId, {
      muted: true,
      deafened: false,
    }).then((r) => r.joined);
  }

  @Post('presence/leave')
  async presenceLeave(
    @Headers('x-music-bot-secret') secret: string | undefined,
    @Body() body: { guildId: string; channelId: string },
  ) {
    this.assertSecret(secret);
    const botId = this.bot.getBotUserId();
    return this.presence.leave(body.guildId, body.channelId, botId);
  }

  @Post('track-ended')
  async trackEnded(
    @Headers('x-music-bot-secret') secret: string | undefined,
    @Body() body: { guildId: string; voiceChannelId: string; textChannelId?: string },
  ) {
    this.assertSecret(secret);
    const state = await this.state.get(body.guildId, body.voiceChannelId);
    if (!state) return { ok: true, empty: true };

    const next = state.queue.shift() ?? null;
    state.nowPlaying = next;
    state.paused = false;
    const textChannelId = body.textChannelId || state.textChannelId;

    if (!next) {
      await this.state.clear(body.guildId, body.voiceChannelId);
      await this.jobs.enqueue({
        type: 'stop',
        guildId: body.guildId,
        voiceChannelId: body.voiceChannelId,
        textChannelId,
      });
      return { ok: true, empty: true };
    }

    await this.state.save(state);
    await this.jobs.enqueue({
      type: 'play_next',
      guildId: body.guildId,
      voiceChannelId: body.voiceChannelId,
      textChannelId,
    });
    // announce via command reply helper — use public announce endpoint logic
    await this.announce(secret, {
      textChannelId,
      content: `[PLAY] **Siradaki:** ${next.title}`,
    });
    return { ok: true, empty: false, track: next };
  }

  @Post('track-meta')
  async trackMeta(
    @Headers('x-music-bot-secret') secret: string | undefined,
    @Body()
    body: {
      guildId: string;
      voiceChannelId: string;
      trackId: string;
      title?: string;
      thumbnailUrl?: string | null;
      durationSec?: number | null;
      webpageUrl?: string | null;
    },
  ) {
    this.assertSecret(secret);
    const state = await this.state.get(body.guildId, body.voiceChannelId);
    if (!state?.nowPlaying || state.nowPlaying.id !== body.trackId) {
      return { ok: false };
    }
    if (body.title) state.nowPlaying.title = body.title;
    if (body.thumbnailUrl) state.nowPlaying.thumbnailUrl = body.thumbnailUrl;
    if (typeof body.durationSec === 'number' && Number.isFinite(body.durationSec)) {
      state.nowPlaying.durationSec = Math.round(body.durationSec);
    }
    if (body.webpageUrl) {
      state.nowPlaying.url = body.webpageUrl;
      state.nowPlaying.source = body.webpageUrl;
    }
    await this.state.save(state);
    return { ok: true };
  }

  @Post('presence/heartbeat')
  async presenceHeartbeat(
    @Headers('x-music-bot-secret') secret: string | undefined,
    @Body() body: { guildId: string; channelId: string },
  ) {
    this.assertSecret(secret);
    const botId = this.bot.getBotUserId();
    const ok = await this.presence.heartbeat(body.guildId, body.channelId, botId);
    return { ok };
  }

  @Post('announce')
  async announce(
    @Headers('x-music-bot-secret') secret: string | undefined,
    @Body() body: { textChannelId: string; content: string },
  ) {
    this.assertSecret(secret);
    await this.commands.reply(body.textChannelId, body.content);
    return { ok: true };
  }

  @Post('state')
  async getState(
    @Headers('x-music-bot-secret') secret: string | undefined,
    @Body() body: { guildId: string; voiceChannelId: string },
  ) {
    this.assertSecret(secret);
    return (await this.state.get(body.guildId, body.voiceChannelId)) ?? null;
  }
}
