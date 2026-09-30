import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

export type YtMeta = {
  title: string;
  webpage_url?: string;
  duration?: number;
  thumbnail?: string;
};

/** Başarılı çıkan player_client — sonraki isteklerde ilk dene */
let workingExtractorArgs: string | null = null;

const DEFAULT_CLIENT_STRATEGIES = [
  'youtube:player_client=android_vr,android',
  'youtube:player_client=android',
  'youtube:player_client=tv_embedded',
  'youtube:player_client=ios',
];

export function ytdlpBin() {
  return process.env.YTDLP_PATH || 'yt-dlp';
}

export function ffmpegBin() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

/**
 * Cookie kaynağı:
 * 1) YTDLP_COOKIES_FILE yolu
 * 2) YTDLP_COOKIES_B64 (sunucu .env'e yapıştırılabilir — volume gerekmez)
 */
export function ensureCookiesFile(): string | null {
  const existing = process.env.YTDLP_COOKIES_FILE?.trim();
  if (existing && hasUsableCookiesFile(existing)) return existing;

  const b64 = process.env.YTDLP_COOKIES_B64?.trim();
  if (!b64) {
    if (existing && existsSync(existing)) return null; // boş stub
    return null;
  }

  try {
    const raw = Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8');
    if (!raw.includes('\t')) {
      console.warn('YTDLP_COOKIES_B64 decoded but looks empty/invalid');
      return null;
    }
    const dir = join(tmpdir(), 'dracord');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'youtube-cookies.txt');
    writeFileSync(path, raw, { mode: 0o600 });
    process.env.YTDLP_COOKIES_FILE = path;
    return path;
  } catch (e) {
    console.warn('YTDLP_COOKIES_B64 write failed', e);
    return null;
  }
}

export function cookiesStatus(): { path: string | null; loaded: boolean } {
  const path = ensureCookiesFile() ?? process.env.YTDLP_COOKIES_FILE?.trim() ?? null;
  return { path, loaded: Boolean(path && hasUsableCookiesFile(path)) };
}

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

function isBotOrAuthError(msg: string): boolean {
  return /sign in to confirm|not a bot|cookies|login required|confirm you.re not/i.test(msg);
}

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

type RunOpts = {
  extractorArgs: string;
  impersonate?: boolean;
};

function buildCommonArgs(opts: RunOpts): string[] {
  const args: string[] = ['--no-playlist', '--no-warnings'];

  const jsRuntimes = process.env.YTDLP_JS_RUNTIMES?.trim();
  if (jsRuntimes) {
    args.push('--js-runtimes', jsRuntimes);
  }

  const remoteComponents = process.env.YTDLP_REMOTE_COMPONENTS?.trim();
  if (remoteComponents) {
    args.push('--remote-components', remoteComponents);
  }

  if (opts.impersonate || process.env.YTDLP_IMPERSONATE === '1') {
    const browser = process.env.YTDLP_IMPERSONATE_BROWSER?.trim() || 'chrome';
    args.push('--impersonate', browser);
  }

  const cookies = ensureCookiesFile();
  if (cookies && hasUsableCookiesFile(cookies)) {
    args.push('--cookies', cookies);
  }

  if (opts.extractorArgs) {
    args.push('--extractor-args', opts.extractorArgs);
  }

  return args;
}

function clientStrategies(): RunOpts[] {
  const forced = process.env.YTDLP_EXTRACTOR_ARGS?.trim();
  if (forced) {
    return [
      { extractorArgs: forced },
      { extractorArgs: forced, impersonate: true },
    ];
  }

  const list = [...DEFAULT_CLIENT_STRATEGIES];
  if (workingExtractorArgs && !list.includes(workingExtractorArgs)) {
    list.unshift(workingExtractorArgs);
  } else if (workingExtractorArgs) {
    list.splice(list.indexOf(workingExtractorArgs), 1);
    list.unshift(workingExtractorArgs);
  }

  const out: RunOpts[] = [];
  for (const extractorArgs of list) {
    out.push({ extractorArgs });
    out.push({ extractorArgs, impersonate: true });
  }
  return out;
}

function runYtdlp(args: string[]): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(ytdlpBin(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString();
    });
    child.on('error', (e) => {
      resolve({ code: 1, out, err: e.message });
    });
    child.on('close', (code) => {
      resolve({ code, out, err });
    });
  });
}

/** Metadata (JSON) — arama veya URL; bot duvarında client fallback */
export async function fetchMeta(source: string): Promise<YtMeta> {
  ensureCookiesFile();
  let lastErr = 'yt-dlp failed';

  for (const opts of clientStrategies()) {
    const args = ['-j', ...buildCommonArgs(opts), source];
    const { code, out, err } = await runYtdlp(args);
    if (code === 0 && out.trim()) {
      try {
        const line = out.trim().split('\n')[0]!;
        const j = JSON.parse(line) as YtMeta;
        workingExtractorArgs = opts.extractorArgs;
        if (opts.impersonate) process.env.YTDLP_IMPERSONATE = '1';
        return j;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        continue;
      }
    }
    lastErr = summarizeYtdlpError(err) || `yt-dlp failed (${code})`;
    console.warn(`[yt-dlp] meta fail (${opts.extractorArgs}${opts.impersonate ? '+impersonate' : ''}): ${lastErr}`);
    if (!isBotOrAuthError(lastErr) && !/unable to extract|requested format/i.test(lastErr)) {
      // Ağ / video yok gibi hatalarda diğer client'ları deneme
      break;
    }
  }

  throw new Error(lastErr);
}

/**
 * yt-dlp audio → ffmpeg s16le 48kHz mono PCM stream.
 */
export function openPcmStream(source: string): {
  ffmpeg: ReturnType<typeof spawn>;
  ytdlp: ReturnType<typeof spawn>;
} {
  ensureCookiesFile();
  const opts: RunOpts = {
    extractorArgs:
      workingExtractorArgs ||
      process.env.YTDLP_EXTRACTOR_ARGS?.trim() ||
      DEFAULT_CLIENT_STRATEGIES[0]!,
    impersonate: process.env.YTDLP_IMPERSONATE === '1',
  };

  const ytdlp = spawn(
    ytdlpBin(),
    [
      '-f',
      'bestaudio/best',
      '-o',
      '-',
      '--quiet',
      ...buildCommonArgs(opts),
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

export function logProcessLines(proc: ReturnType<typeof spawn>, label: string) {
  if (!proc.stderr) return;
  const rl = createInterface({ input: proc.stderr });
  rl.on('line', (line: string) => {
    if (line.trim()) console.warn(`[${label}] ${line}`);
  });
}
