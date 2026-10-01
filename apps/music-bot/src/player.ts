import {
  AudioFrame,
  AudioSource,
  LocalAudioTrack,
  Room,
  TrackPublishOptions,
  TrackSource,
} from '@livekit/rtc-node';
import { AudioEncoding } from '@livekit/rtc-ffi-bindings';
import type { MusicQueueState, MusicTrack } from '@dracord/types';
import * as api from './api';
import { cookiesStatus, fetchMeta, logProcessLines, openPcmStream } from './ytdlp';

const SAMPLE_RATE = 48000;
const CHANNELS = 1;
/** 20ms frames */
const SAMPLES_PER_FRAME = 960;
/** LiveKit AudioSource queue (ms) — sürekli PCM için geniş tut */
const SOURCE_QUEUE_MS = 2000;

const BITRATE_PRESETS = [320, 192, 160, 128, 64, 32] as const;

function musicPublishBitrateBps(): bigint {
  const raw = Number(process.env.MUSIC_AUDIO_BITRATE_KBPS ?? 320);
  const kbps = BITRATE_PRESETS.includes(raw as (typeof BITRATE_PRESETS)[number]) ? raw : 320;
  return BigInt(kbps * 1000);
}

type Session = {
  guildId: string;
  voiceChannelId: string;
  textChannelId?: string;
  room: Room;
  source: AudioSource;
  track: LocalAudioTrack;
  volume: number;
  paused: boolean;
  stopPlayback: (() => void) | null;
  playing: boolean;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
};

/**
 * LiveKit rtc-node AudioFrame.protoInfo, Int16Array.buffer'ı byteOffset
 * olmadan FFI'ye verir. Node Buffer pool view'ları (byteOffset>0) sessiz /
 * bozuk ses üretir — her frame yeni, offset=0 Int16Array olmalı.
 */
function pcmFrameToSamples(frameBuf: Buffer, sampleCount: number): Int16Array {
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = frameBuf.readInt16LE(i * 2);
  }
  return samples;
}

export class MusicPlayer {
  private sessions = new Map<string, Session>();
  /** Aynı kanal için paralel ensure_session yarışını önle */
  private connecting = new Map<string, Promise<Session>>();

  private key(guildId: string, voiceChannelId: string) {
    return `${guildId}:${voiceChannelId}`;
  }

  async ensureSession(guildId: string, voiceChannelId: string, textChannelId?: string) {
    const k = this.key(guildId, voiceChannelId);
    const existing = this.sessions.get(k);
    if (existing) {
      if (textChannelId) existing.textChannelId = textChannelId;
      try {
        const state = await api.getState(guildId, voiceChannelId);
        if (state && typeof state.volume === 'number') existing.volume = state.volume;
      } catch {
        /* ignore */
      }
      return existing;
    }

    const inflight = this.connecting.get(k);
    if (inflight) {
      const session = await inflight;
      if (textChannelId) session.textChannelId = textChannelId;
      return session;
    }

    const promise = this.createSession(guildId, voiceChannelId, textChannelId).finally(() => {
      this.connecting.delete(k);
    });
    this.connecting.set(k, promise);
    return promise;
  }

  private async createSession(
    guildId: string,
    voiceChannelId: string,
    textChannelId?: string,
  ): Promise<Session> {
    const k = this.key(guildId, voiceChannelId);
    const existing = this.sessions.get(k);
    if (existing) {
      if (textChannelId) existing.textChannelId = textChannelId;
      return existing;
    }

    const { token, url, roomName } = await api.getToken(voiceChannelId);
    const room = new Room();
    const livekitUrl = String(url).replace(/^http/, 'ws');
    await room.connect(livekitUrl, token, {
      autoSubscribe: false,
      dynacast: false,
    });
    console.log(`LiveKit connected: ${roomName} via ${livekitUrl}`);

    const source = new AudioSource(SAMPLE_RATE, CHANNELS, SOURCE_QUEUE_MS);
    const track = LocalAudioTrack.createAudioTrack('dracord-music', source);
    const options = new TrackPublishOptions();
    options.source = TrackSource.SOURCE_MICROPHONE;
    // Müzik için DTX kapat — aksi halde kodlayıcı sessizlik sanıp ses kesilir
    options.dtx = false;
    options.red = false;
    const bitrate = musicPublishBitrateBps();
    options.audioEncoding = new AudioEncoding({ maxBitrate: bitrate });
    await room.localParticipant!.publishTrack(track, options);
    console.log(`Audio track published (dtx=false, bitrate=${bitrate}bps)`);

    await api.presenceJoin(guildId, voiceChannelId).catch((e) => {
      console.warn('presence join failed', e);
    });

    let volume = 80;
    try {
      const state = await api.getState(guildId, voiceChannelId);
      if (state && typeof state.volume === 'number') volume = state.volume;
    } catch {
      /* ignore */
    }

    const s: Session = {
      guildId,
      voiceChannelId,
      textChannelId,
      room,
      source,
      track,
      volume,
      paused: false,
      stopPlayback: null,
      playing: false,
      heartbeatTimer: setInterval(() => {
        void api.presenceHeartbeat(guildId, voiceChannelId).catch(() => undefined);
      }, 30_000),
    };
    this.sessions.set(k, s);
    return s;
  }

  async stopSession(guildId: string, voiceChannelId: string) {
    const k = this.key(guildId, voiceChannelId);
    const s = this.sessions.get(k);
    if (!s) return;
    s.stopPlayback?.();
    s.playing = false;
    if (s.heartbeatTimer) clearInterval(s.heartbeatTimer);
    try {
      s.source.clearQueue();
    } catch {
      /* ignore */
    }
    try {
      await s.room.disconnect();
    } catch {
      /* ignore */
    }
    await api.presenceLeave(guildId, voiceChannelId).catch(() => undefined);
    this.sessions.delete(k);
  }

  setPaused(guildId: string, voiceChannelId: string, paused: boolean) {
    const s = this.sessions.get(this.key(guildId, voiceChannelId));
    if (s) s.paused = paused;
  }

  setVolume(guildId: string, voiceChannelId: string, volume: number) {
    const s = this.sessions.get(this.key(guildId, voiceChannelId));
    if (s) s.volume = Math.max(0, Math.min(100, volume));
  }

  async skip(guildId: string, voiceChannelId: string, textChannelId?: string) {
    const s = this.sessions.get(this.key(guildId, voiceChannelId));
    s?.stopPlayback?.();
    try {
      s?.source.clearQueue();
    } catch {
      /* ignore */
    }
    await api.trackEnded({ guildId, voiceChannelId, textChannelId });
  }

  async playCurrent(guildId: string, voiceChannelId: string, textChannelId?: string) {
    const state = await api.getState(guildId, voiceChannelId);
    if (!state?.nowPlaying) {
      await this.stopSession(guildId, voiceChannelId);
      return;
    }
    const session = await this.ensureSession(
      guildId,
      voiceChannelId,
      textChannelId || state.textChannelId,
    );
    session.volume = state.volume;
    session.paused = state.paused;
    await this.playTrack(session, state.nowPlaying, state);
  }

  private async playTrack(session: Session, track: MusicTrack, state: MusicQueueState) {
    session.stopPlayback?.();
    try {
      session.source.clearQueue();
    } catch {
      /* ignore */
    }
    session.playing = true;

    let source = track.source;
    try {
      const meta = await fetchMeta(source);
      if (meta.webpage_url) source = meta.webpage_url;
      console.log(`Playing: ${meta.title || track.title}`);
      await api
        .trackMeta({
          guildId: session.guildId,
          voiceChannelId: session.voiceChannelId,
          trackId: track.id,
          title: meta.title || track.title,
          thumbnailUrl: meta.thumbnail ?? track.thumbnailUrl ?? null,
          durationSec: typeof meta.duration === 'number' ? meta.duration : track.durationSec ?? null,
          webpageUrl: meta.webpage_url ?? null,
        })
        .catch((e) => console.warn('track meta update failed', e));
    } catch (e) {
      console.error('resolve failed', e);
      let msg = (e as Error).message.slice(0, 220);
      if (/relay kapali|relay basarisiz|relay fail|fetch failed/i.test(msg)) {
        msg =
          'Ev YouTube relay kapalı. PC’de start-yt-relay.ps1 + cloudflared aç; yeni trycloudflare URL’yi .env → YTDLP_RELAY_URL yazıp music-bot recreate et.';
      } else if (/not a bot|Sign in|cookies|LOGIN_REQUIRED/i.test(msg)) {
        if (!cookiesStatus().loaded) {
          msg =
            'YouTube cookie yok. .env → YTDLP_COOKIES_B64 (scripts/encode-youtube-cookies.ps1), music-bot recreate.';
        } else {
          msg =
            'Hetzner bot duvarı — cookie yetmez. Ev relay (start-yt-relay.ps1 + cloudflared) veya residential YTDLP_PROXY şart.';
        }
      }
      if (session.textChannelId) {
        await api
          .announce(session.textChannelId, `❌ Çalınamadı: **${track.title}** — ${msg}`)
          .catch(() => undefined);
      }
      await api.trackEnded({
        guildId: session.guildId,
        voiceChannelId: session.voiceChannelId,
        textChannelId: session.textChannelId,
      });
      return;
    }

    const { ffmpeg, ytdlp } = openPcmStream(source);
    if (ytdlp) logProcessLines(ytdlp, 'yt-dlp');
    logProcessLines(ffmpeg, 'ffmpeg');

    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      try {
        ytdlp?.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      try {
        ffmpeg.kill('SIGKILL');
      } catch {
        /* ignore */
      }
    };
    session.stopPlayback = stop;

    const pcm = ffmpeg.stdout!;
    let leftover = Buffer.alloc(0);
    const bytesPerFrame = SAMPLES_PER_FRAME * 2; // s16le
    let framesSent = 0;

    const pump = async () => {
      let naturalEnd = false;
      try {
        for await (const chunk of pcm) {
          if (stopped) break;
          while (session.paused && !stopped) {
            await new Promise((r) => setTimeout(r, 50));
          }
          if (stopped) break;

          leftover = Buffer.concat([leftover, chunk as Buffer]);
          while (leftover.length >= bytesPerFrame) {
            const frameBuf = leftover.subarray(0, bytesPerFrame);
            leftover = leftover.subarray(bytesPerFrame);

            const samples = pcmFrameToSamples(frameBuf, SAMPLES_PER_FRAME);
            const gain = session.volume / 100;
            if (gain !== 1) {
              for (let i = 0; i < samples.length; i++) {
                samples[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i]! * gain)));
              }
            }

            const frame = new AudioFrame(samples, SAMPLE_RATE, CHANNELS, SAMPLES_PER_FRAME);
            await session.source.captureFrame(frame);
            framesSent += 1;
            if (framesSent === 1) {
              console.log('First audio frame captured');
            }
          }
        }
        naturalEnd = !stopped;
      } catch (e) {
        if (!stopped) console.error('playback error', e);
      } finally {
        stop();
        session.playing = false;
        session.stopPlayback = null;
        console.log(`Playback ended (frames=${framesSent}, natural=${naturalEnd})`);
        if (naturalEnd) {
          await api.trackEnded({
            guildId: session.guildId,
            voiceChannelId: session.voiceChannelId,
            textChannelId: session.textChannelId || state.textChannelId,
          });
        }
      }
    };

    void pump();
  }
}
