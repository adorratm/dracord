import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { MusicJobPayload } from '@dracord/types';
import { MusicPlayer } from './player';
import { cookiesStatus } from './ytdlp';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const QUEUE = 'dracord-music';

async function main() {
  console.log('Dracord music-bot starting…');
  const cookies = cookiesStatus();
  if (cookies.loaded) {
    console.log(`YouTube cookies: loaded (${cookies.path})`);
  } else {
    console.warn(
      'YouTube cookies: MISSING — datacenter IP bot duvarı aşılmaz. ' +
        'YTDLP_COOKIES_B64 veya YTDLP_COOKIES_FILE ayarla (scripts/encode-youtube-cookies.ps1).',
    );
  }
  if (process.env.YTDLP_IMPERSONATE === '1') {
    console.log('yt-dlp impersonate: enabled');
  }
  const player = new MusicPlayer();

  const worker = new Worker<MusicJobPayload>(
    QUEUE,
    async (job: Job<MusicJobPayload>) => {
      const p = job.data;
      console.log(`job ${job.name}`, p);
      switch (p.type) {
        case 'ensure_session':
          await player.ensureSession(p.guildId, p.voiceChannelId, p.textChannelId);
          break;
        case 'play_next':
          await player.playCurrent(p.guildId, p.voiceChannelId, p.textChannelId);
          break;
        case 'skip':
          await player.skip(p.guildId, p.voiceChannelId, p.textChannelId);
          break;
        case 'pause':
          player.setPaused(p.guildId, p.voiceChannelId, true);
          break;
        case 'resume':
          player.setPaused(p.guildId, p.voiceChannelId, false);
          break;
        case 'stop':
          await player.stopSession(p.guildId, p.voiceChannelId);
          break;
        case 'set_volume':
          if (typeof p.volume === 'number') {
            player.setVolume(p.guildId, p.voiceChannelId, p.volume);
          }
          break;
        default:
          console.warn('unknown job', p);
      }
    },
    {
      connection: { url: REDIS_URL },
      // Aynı kanalda ensure/play yarışını ve çift LiveKit join'i engelle
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`job failed ${job?.id}`, err);
  });

  console.log(`Listening on queue ${QUEUE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
