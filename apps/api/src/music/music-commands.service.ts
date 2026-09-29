import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { MusicTrack } from '@dracord/types';
import { BotService } from '@/bot/bot.service';
import { Channel } from '@/database/entities/channel.entity';
import { Message } from '@/database/entities/message.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType } from '@/database/enums';
import { toPublicUser } from '@/common/user.mapper';
import { MessagesRealtimeService } from '@/messages/messages-realtime.service';
import { VoicePresenceService } from '@/voice/voice-presence.service';
import { MusicJobsService } from './music-jobs.service';
import { MusicResolveService } from './music-resolve.service';
import { MusicStateService } from './music-state.service';

@Injectable()
export class MusicCommandsService {
  private readonly logger = new Logger(MusicCommandsService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly presence: VoicePresenceService,
    private readonly state: MusicStateService,
    private readonly resolve: MusicResolveService,
    private readonly jobs: MusicJobsService,
    private readonly bot: BotService,
    private readonly realtime: MessagesRealtimeService,
  ) {}

  /** `/` ile başlayan komutları işler. true = komut yakalandı (yanıt gönderildi). */
  async tryHandle(
    authorId: string,
    textChannelId: string,
    content: string,
  ): Promise<boolean> {
    const trimmed = content.trim();
    if (!trimmed.startsWith('/')) return false;

    const [rawCmd, ...rest] = trimmed.slice(1).split(/\s+/);
    const cmd = (rawCmd || '').toLocaleLowerCase('tr-TR');
    const arg = rest.join(' ').trim();

    const known = [
      'oynat',
      'play',
      'atla',
      'skip',
      'duraklat',
      'pause',
      'devam',
      'resume',
      'durdur',
      'stop',
      'kuyruk',
      'queue',
      'ses',
      'volume',
      'kaldir',
      'remove',
    ];
    if (!known.includes(cmd)) return false;

    try {
      switch (cmd) {
        case 'oynat':
        case 'play':
          await this.cmdPlay(authorId, textChannelId, arg);
          break;
        case 'atla':
        case 'skip':
          await this.cmdSkip(authorId, textChannelId);
          break;
        case 'duraklat':
        case 'pause':
          await this.cmdPause(authorId, textChannelId, true);
          break;
        case 'devam':
        case 'resume':
          await this.cmdPause(authorId, textChannelId, false);
          break;
        case 'durdur':
        case 'stop':
          await this.cmdStop(authorId, textChannelId);
          break;
        case 'kuyruk':
        case 'queue':
          await this.cmdQueue(authorId, textChannelId);
          break;
        case 'ses':
        case 'volume':
          await this.cmdVolume(authorId, textChannelId, arg);
          break;
        case 'kaldir':
        case 'remove':
          await this.cmdRemove(authorId, textChannelId, arg);
          break;
        default:
          return false;
      }
    } catch (err) {
      this.logger.warn(`Komut hatasi /${cmd}: ${(err as Error).message}`);
      await this.reply(textChannelId, `Uyari: ${(err as Error).message}`);
    }
    return true;
  }

  private async requireVoice(authorId: string, textChannelId: string) {
    const textCh = await this.em.findOne(Channel, { where: { id: textChannelId } });
    if (!textCh?.guildId) {
      throw new Error('Muzik komutlari yalnizca sunucu kanallarinda calisir.');
    }
    const locs = await this.presence.getUserVoiceLocations(authorId);
    const loc = locs.find((l) => l.guildId === textCh.guildId) ?? locs[0];
    if (!loc) {
      throw new Error('Once bir ses kanalina gir, sonra `/oynat` kullan.');
    }
    const voiceCh = await this.em.findOne(Channel, { where: { id: loc.channelId } });
    if (!voiceCh || voiceCh.type !== ChannelType.VOICE) {
      throw new Error('Gecerli bir ses kanali bulunamadi.');
    }
    return { guildId: loc.guildId, voiceChannelId: loc.channelId, textChannelId };
  }

  private async cmdPlay(authorId: string, textChannelId: string, arg: string) {
    if (!arg) throw new Error('Kullanim: `/oynat <url veya arama>`');
    const ctx = await this.requireVoice(authorId, textChannelId);
    const author = await this.em.findOneOrFail(User, { where: { id: authorId } });
    const resolvedList = await this.resolve.resolveMany(arg, 25);

    let state =
      (await this.state.get(ctx.guildId, ctx.voiceChannelId)) ??
      this.state.emptyState(ctx.guildId, ctx.voiceChannelId, textChannelId);
    state.textChannelId = textChannelId;

    const tracks: MusicTrack[] = resolvedList.map((r) =>
      this.state.makeTrack({
        title: r.title,
        url: arg,
        source: r.source,
        requestedById: authorId,
        requestedByName: author.displayName,
        durationSec: r.durationSec ?? null,
        thumbnailUrl: r.thumbnailUrl ?? null,
      }),
    );

    const wasIdle = !state.nowPlaying;
    if (wasIdle && tracks[0]) {
      state.nowPlaying = tracks[0];
      state.queue.push(...tracks.slice(1));
    } else {
      state.queue.push(...tracks);
    }
    state.paused = false;
    await this.state.save(state);

    if (wasIdle) {
      await this.jobs.enqueue({
        type: 'play_next',
        guildId: ctx.guildId,
        voiceChannelId: ctx.voiceChannelId,
        textChannelId,
      });
      await this.reply(
        textChannelId,
        `[PLAY] **Caliyor:** ${tracks[0]!.title}\nIsteyen: ${author.displayName}`,
      );
    } else {
      const pos = state.queue.length;
      await this.reply(
        textChannelId,
        `[QUEUE] Kuyruga eklendi (#${pos}): **${tracks[0]!.title}**${
          tracks.length > 1 ? ` (+${tracks.length - 1} parca)` : ''
        }`,
      );
    }
  }

  private async cmdSkip(authorId: string, textChannelId: string) {
    const ctx = await this.requireVoice(authorId, textChannelId);
    const state = await this.state.get(ctx.guildId, ctx.voiceChannelId);
    if (!state?.nowPlaying) throw new Error('Su an calan bir parca yok.');
    await this.jobs.enqueue({
      type: 'skip',
      guildId: ctx.guildId,
      voiceChannelId: ctx.voiceChannelId,
      textChannelId,
    });
    await this.reply(textChannelId, `[SKIP] Atlandi: **${state.nowPlaying.title}**`);
  }

  private async cmdPause(authorId: string, textChannelId: string, pause: boolean) {
    const ctx = await this.requireVoice(authorId, textChannelId);
    const state = await this.state.get(ctx.guildId, ctx.voiceChannelId);
    if (!state?.nowPlaying) throw new Error('Su an calan bir parca yok.');
    state.paused = pause;
    await this.state.save(state);
    await this.jobs.enqueue({
      type: pause ? 'pause' : 'resume',
      guildId: ctx.guildId,
      voiceChannelId: ctx.voiceChannelId,
      textChannelId,
    });
    await this.reply(
      textChannelId,
      pause
        ? `[PAUSE] Duraklatildi: **${state.nowPlaying.title}**`
        : `[PLAY] Devam: **${state.nowPlaying.title}**`,
    );
  }

  private async cmdStop(authorId: string, textChannelId: string) {
    const ctx = await this.requireVoice(authorId, textChannelId);
    await this.state.clear(ctx.guildId, ctx.voiceChannelId);
    await this.jobs.enqueue({
      type: 'stop',
      guildId: ctx.guildId,
      voiceChannelId: ctx.voiceChannelId,
      textChannelId,
    });
    await this.reply(textChannelId, '[STOP] Muzik durduruldu, kuyruk temizlendi.');
  }

  private async cmdQueue(authorId: string, textChannelId: string) {
    const ctx = await this.requireVoice(authorId, textChannelId);
    const state = await this.state.get(ctx.guildId, ctx.voiceChannelId);
    if (!state?.nowPlaying && (!state || state.queue.length === 0)) {
      await this.reply(textChannelId, '[QUEUE] Kuyruk bos.');
      return;
    }
    const lines: string[] = [];
    if (state!.nowPlaying) {
      lines.push(`[PLAY] **Simdi:** ${state!.nowPlaying.title}`);
    }
    state!.queue.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.title} _( ${t.requestedByName} )_`);
    });
    lines.push(`[VOL] Ses: %${state!.volume}${state!.paused ? ' · duraklatildi' : ''}`);
    await this.reply(textChannelId, lines.join('\n'));
  }

  private async cmdVolume(authorId: string, textChannelId: string, arg: string) {
    const ctx = await this.requireVoice(authorId, textChannelId);
    const n = Number(arg);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error('Kullanim: `/ses <0-100>`');
    }
    let state =
      (await this.state.get(ctx.guildId, ctx.voiceChannelId)) ??
      this.state.emptyState(ctx.guildId, ctx.voiceChannelId, textChannelId);
    state.volume = Math.round(n);
    state.textChannelId = textChannelId;
    await this.state.save(state);
    await this.jobs.enqueue({
      type: 'set_volume',
      guildId: ctx.guildId,
      voiceChannelId: ctx.voiceChannelId,
      textChannelId,
      volume: state.volume,
    });
    await this.reply(textChannelId, `[VOL] Ses seviyesi: %${state.volume}`);
  }

  private async cmdRemove(authorId: string, textChannelId: string, arg: string) {
    const ctx = await this.requireVoice(authorId, textChannelId);
    const idx = Number(arg) - 1;
    const state = await this.state.get(ctx.guildId, ctx.voiceChannelId);
    if (!state || !Number.isFinite(idx) || idx < 0 || idx >= state.queue.length) {
      throw new Error('Kullanim: `/kaldir <kuyruk numarasi>`');
    }
    const [removed] = state.queue.splice(idx, 1);
    await this.state.save(state);
    await this.reply(textChannelId, `[DEL] Kuyruktan silindi: **${removed?.title}**`);
  }

  async reply(textChannelId: string, content: string) {
    const botId = this.bot.getBotUserId();
    await this.bot.ensureBotUser();
    const author = await this.em.findOneOrFail(User, { where: { id: botId } });
    const saved = await this.em.save(
      Message,
      this.em.create(Message, {
        channelId: textChannelId,
        authorId: botId,
        content,
        type: 'default',
      }),
    );
    const message = await this.em.findOneOrFail(Message, {
      where: { id: saved.id },
      relations: { author: true },
    });
    const dto = {
      id: message.id,
      channelId: message.channelId,
      author: toPublicUser(message.author ?? author),
      content: message.content,
      type: 'default' as const,
      attachments: undefined,
      embeds: undefined,
      poll: undefined,
      replyTo: null,
      forwardedFrom: null,
      pinnedAt: null,
      reactions: [],
      createdAt: message.createdAt.toISOString(),
      updatedAt: null,
    };
    this.realtime.emitCreate(textChannelId, dto);
  }
}
