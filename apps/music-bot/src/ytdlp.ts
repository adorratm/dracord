import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

export type YtMeta = {
  title: string;
  webpage_url?: string;
  duration?: number;
  thumbnail?: string;
};

export function ytdlpBin() {
  return process.env.YTDLP_PATH || 'yt-dlp';
}

export function ffmpegBin() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

/**
 * Ortak yt-dlp bayrakları.
 *
 * Not: Varsayılan olarak `--js-runtimes node` KULLANILMAZ — güncel yt-dlp’de
 * EJS bileşeni olmadan Python traceback üretebiliyor. Android client JS istemez.
 * Gerekirse: YTDLP_JS_RUNTIMES=node ve YTDLP_REMOTE_COMPONENTS=ejs:github
 */
export function commonYtdlpArgs(): string[] {
  const args: string[] = ['--no-playlist', '--no-warnings'];

  const jsRuntimes = process.env.YTDLP_JS_RUNTIMES?.trim();
  if (jsRuntimes) {
    args.push('--js-runtimes', jsRuntimes);
  }

  const remoteComponents = process.env.YTDLP_REMOTE_COMPONENTS?.trim();
  if (remoteComponents) {
    args.push('--remote-components', remoteComponents);
  }

  const cookies = process.env.YTDLP_COOKIES_FILE?.trim();
  if (cookies && hasUsableCookiesFile(cookies)) {
    args.push('--cookies', cookies);
  }

  // android* JS challenge istemez; web/mweb bot + nsig için EJS ister
  const extractorArgs =
    process.env.YTDLP_EXTRACTOR_ARGS?.trim() ||
    'youtube:player_client=android_vr,android';
  if (extractorArgs) {
    args.push('--extractor-args', extractorArgs);
  }

  return args;
}

export function cookiesStatus(): { path: string | null; loaded: boolean } {
  const path = process.env.YTDLP_COOKIES_FILE?.trim() || null;
  return { path, loaded: Boolean(path && hasUsableCookiesFile(path)) };
}

/** Netscape cookies.txt — yorum satırı dışında gerçek cookie satırı var mı */
function hasUsableCookiesFile(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const text = readFileSync(path, 'utf8');
    return text.split('\n').some((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('#') && t.includes('\t');
    });
  } catch {
    return false;
  }
}

/** Discord / log için traceback yerine son ERROR satırı */
export function summarizeYtdlpError(err: string): string {
  const lines = err
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errorLine = [...lines].reverse().find((l) => /^ERROR:/i.test(l));
  if (errorLine) {
    return errorLine.replace(/^ERROR:\s*/i, '').slice(0, 180);
  }
  const useful = [...lines]
    .reverse()
    .find(
      (l) =>
        !/^Traceback\b/i.test(l) &&
        !/^File\b/.test(l) &&
        !/^\^/.test(l) &&
        !/^during handling/i.test(l) &&
        !/^The above exception/i.test(l),
    );
  return (useful || err).slice(0, 180);
}

/** Metadata (JSON) — arama veya URL */
export async function fetchMeta(source: string): Promise<YtMeta> {
  return new Promise((resolve, reject) => {
    const args = ['-j', ...commonYtdlpArgs(), source];
    const child = spawn(ytdlpBin(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString();
    });
    child.on('close', (code: number | null) => {
      if (code !== 0 || !out.trim()) {
        reject(new Error(summarizeYtdlpError(err) || `yt-dlp failed (${code})`));
        return;
      }
      try {
        const line = out.trim().split('\n')[0]!;
        const j = JSON.parse(line) as YtMeta;
        resolve(j);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * yt-dlp audio → ffmpeg s16le 48kHz mono PCM stream.
 * Returns a readable process stdout of raw PCM.
 */
export function openPcmStream(source: string): {
  ffmpeg: ReturnType<typeof spawn>;
  ytdlp: ReturnType<typeof spawn>;
} {
  const ytdlp = spawn(
    ytdlpBin(),
    [
      '-f',
      'bestaudio/best',
      '-o',
      '-',
      '--quiet',
      ...commonYtdlpArgs(),
      source,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const ffmpeg = spawn(
    ffmpegBin(),
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-f',
      's16le',
      '-acodec',
      'pcm_s16le',
      '-ac',
      '1',
      '-ar',
      '48000',
      'pipe:1',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );

  ytdlp.stdout!.pipe(ffmpeg.stdin!);
  // stop/kill sırasında EPIPE ile process çökmesin
  const ignorePipeErr = () => undefined;
  ytdlp.stdout?.on('error', ignorePipeErr);
  ffmpeg.stdin?.on('error', ignorePipeErr);
  ffmpeg.stdout?.on('error', ignorePipeErr);
  ytdlp.on('error', ignorePipeErr);
  ffmpeg.on('error', ignorePipeErr);
  ytdlp.stderr?.on('data', () => undefined);
  ffmpeg.stderr?.on('data', () => undefined);

  ytdlp.on('close', (code: number | null) => {
    if (code && code !== 0) {
      try {
        ffmpeg.stdin?.end();
      } catch {
        /* ignore */
      }
    }
  });

  return { ffmpeg, ytdlp };
}

/** Drain stderr lines for debugging */
export function logProcessLines(proc: ReturnType<typeof spawn>, label: string) {
  if (!proc.stderr) return;
  const rl = createInterface({ input: proc.stderr });
  rl.on('line', (line: string) => {
    if (line.trim()) console.warn(`[${label}] ${line}`);
  });
}
