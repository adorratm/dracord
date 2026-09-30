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

export type CookiesInfo = {
  path: string | null;
  loaded: boolean;
  source: 'b64' | 'file' | null;
  /** Netscape satır sayısı (yorum hariç) */
  lineCount: number;
  /** LOGIN_INFO / PSID var mı — değer yazılmaz */
  hasLoginHints: boolean;
};

/** Başarılı çıkan player_client */
let workingExtractorArgs: string | null = null;
let workingImpersonate = false;
let workingSkipCookies = false;
let cookiesResolved: CookiesInfo | null = null;

/** Cookie varken oturumu kullanan client’lar (android_* cookie’yi yok sayıp bot duvarına düşer) */
const COOKIE_CLIENTS = [
  'youtube:player_client=tv',
  'youtube:player_client=tv_embedded',
  'youtube:player_client=web_embedded',
  'youtube:player_client=web_safari',
  'youtube:player_client=mweb',
  'youtube:player_client=web',
];

/** Cookie’siz denenecek client’lar */
const ANON_CLIENTS = [
  'youtube:player_client=android_vr,android',
  'youtube:player_client=android',
  'youtube:player_client=ios',
];

export function ytdlpBin() {
  return process.env.YTDLP_PATH || 'yt-dlp';
}

export function ffmpegBin() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

function inspectCookiesText(text: string): { lineCount: number; hasLoginHints: boolean } {
  const data = text.split(/\r?\n/).filter((line) => {
    const t = line.trim();
    return t.length > 0 && !t.startsWith('#') && t.includes('\t');
  });
  const blob = data.join('\n');
  const hasLoginHints =
    /\bLOGIN_INFO\b/.test(blob) ||
    /\b__Secure-1PSID\b/.test(blob) ||
    /\b__Secure-3PSID\b/.test(blob) ||
    /\bSID\b/.test(blob);
  return { lineCount: data.length, hasLoginHints };
}

function writeCookiesTemp(raw: string): string {
  const dir = join(tmpdir(), 'dracord');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'youtube-cookies.txt');
  writeFileSync(path, raw, { mode: 0o600 });
  return path;
}

/**
 * Cookie önceliği:
 * 1) YTDLP_COOKIES_B64 (sunucu .env — mount’taki eski stub’ı ezer)
 * 2) YTDLP_COOKIES_FILE
 */
export function ensureCookiesFile(): string | null {
  if (cookiesResolved?.path && hasUsableCookiesFile(cookiesResolved.path)) {
    return cookiesResolved.path;
  }

  const b64 = process.env.YTDLP_COOKIES_B64?.trim();
  if (b64) {
    try {
      const raw = Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8');
      const info = inspectCookiesText(raw);
      if (info.lineCount === 0) {
        console.warn('YTDLP_COOKIES_B64 decoded but no cookie rows');
      } else {
        const path = writeCookiesTemp(raw);
        process.env.YTDLP_COOKIES_FILE = path;
        cookiesResolved = {
          path,
          loaded: true,
          source: 'b64',
          lineCount: info.lineCount,
          hasLoginHints: info.hasLoginHints,
        };
        return path;
      }
    } catch (e) {
      console.warn('YTDLP_COOKIES_B64 write failed', e);
    }
  }

  const existing = process.env.YTDLP_COOKIES_FILE?.trim();
  if (existing && hasUsableCookiesFile(existing)) {
    try {
      const text = readFileSync(existing, 'utf8');
      const info = inspectCookiesText(text);
      cookiesResolved = {
        path: existing,
        loaded: true,
        source: 'file',
        lineCount: info.lineCount,
        hasLoginHints: info.hasLoginHints,
      };
      return existing;
    } catch {
      return existing;
    }
  }

  cookiesResolved = {
    path: existing || null,
    loaded: false,
    source: null,
    lineCount: 0,
    hasLoginHints: false,
  };
  return null;
}

export function cookiesStatus(): CookiesInfo {
  ensureCookiesFile();
  return (
    cookiesResolved ?? {
      path: null,
      loaded: false,
      source: null,
      lineCount: 0,
      hasLoginHints: false,
    }
  );
}

function hasUsableCookiesFile(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const text = readFileSync(path, 'utf8');
    return inspectCookiesText(text).lineCount > 0;
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
  /** web/mweb için JS challenge */
  needJs?: boolean;
  /** android denemelerinde bozuk cookie’yi atla */
  skipCookies?: boolean;
};

function resolveProxy(): string | null {
  return (
    process.env.YTDLP_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    null
  );
}

function buildCommonArgs(opts: RunOpts): string[] {
  const args: string[] = ['--no-playlist', '--no-warnings'];

  const proxy = resolveProxy();
  if (proxy) {
    args.push('--proxy', proxy);
  }

  if (opts.needJs) {
    args.push('--js-runtimes', process.env.YTDLP_JS_RUNTIMES?.trim() || 'node');
    args.push(
      '--remote-components',
      process.env.YTDLP_REMOTE_COMPONENTS?.trim() || 'ejs:github',
    );
  } else {
    const jsRuntimes = process.env.YTDLP_JS_RUNTIMES?.trim();
    if (jsRuntimes) args.push('--js-runtimes', jsRuntimes);
    const remoteComponents = process.env.YTDLP_REMOTE_COMPONENTS?.trim();
    if (remoteComponents) args.push('--remote-components', remoteComponents);
  }

  if (opts.impersonate) {
    const browser = process.env.YTDLP_IMPERSONATE_BROWSER?.trim() || 'chrome';
    args.push('--impersonate', browser);
  }

  if (!opts.skipCookies) {
    const cookies = ensureCookiesFile();
    if (cookies && hasUsableCookiesFile(cookies)) {
      args.push('--cookies', cookies);
    }
  }

  if (opts.extractorArgs) {
    args.push('--extractor-args', opts.extractorArgs);
  }

  return args;
}

function clientStrategies(): RunOpts[] {
  const hasCookies = Boolean(ensureCookiesFile() && cookiesStatus().loaded);
  const forced = process.env.YTDLP_EXTRACTOR_ARGS?.trim();

  // Cookie varken tv/web* önce; android sonda veya cookie’siz
  const preferred = hasCookies
    ? [...COOKIE_CLIENTS, ...ANON_CLIENTS]
    : [...ANON_CLIENTS, ...COOKIE_CLIENTS];

  const clients = [
    ...(forced ? [forced] : []),
    ...preferred,
    ...(workingExtractorArgs ? [workingExtractorArgs] : []),
  ];
  const seen = new Set<string>();
  const unique = clients.filter((c) => {
    if (!c || seen.has(c)) return false;
    seen.add(c);
    return true;
  });

  if (workingExtractorArgs && unique.includes(workingExtractorArgs)) {
    unique.splice(unique.indexOf(workingExtractorArgs), 1);
    unique.unshift(workingExtractorArgs);
  }

  const out: RunOpts[] = [];
  for (const extractorArgs of unique) {
    const needJs = /player_client=(web|mweb|web_safari)\b/.test(extractorArgs);
    const isAndroid = /player_client=android/.test(extractorArgs);

    if (hasCookies) {
      out.push({ extractorArgs, needJs });
      out.push({ extractorArgs, needJs, impersonate: true });
      // android + cookie bazen daha kötü; cookie’siz de dene
      if (isAndroid) {
        out.push({ extractorArgs, needJs, skipCookies: true });
        out.push({ extractorArgs, needJs, impersonate: true, skipCookies: true });
      }
    } else {
      out.push({ extractorArgs, needJs, skipCookies: true });
      out.push({ extractorArgs, needJs, impersonate: true, skipCookies: true });
    }
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

/** Metadata (JSON) — bot duvarında tüm client fallback’leri dene */
export async function fetchMeta(source: string): Promise<YtMeta> {
  ensureCookiesFile();
  let lastErr = 'yt-dlp failed';
  const strategies = clientStrategies();
  const proxy = resolveProxy();

  for (const opts of strategies) {
    const args = ['-j', ...buildCommonArgs(opts), source];
    const { code, out, err } = await runYtdlp(args);
    if (code === 0 && out.trim()) {
      try {
        const line = out.trim().split('\n')[0]!;
        const j = JSON.parse(line) as YtMeta;
        workingExtractorArgs = opts.extractorArgs;
        workingImpersonate = Boolean(opts.impersonate);
        workingSkipCookies = Boolean(opts.skipCookies);
        return j;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        continue;
      }
    }
    lastErr = summarizeYtdlpError(err) || `yt-dlp failed (${code})`;
    console.warn(
      `[yt-dlp] meta fail (${opts.extractorArgs}${opts.impersonate ? '+impersonate' : ''}${opts.needJs ? '+js' : ''}${opts.skipCookies ? '+nocookie' : ''}): ${lastErr}`,
    );
    if (!isBotOrAuthError(lastErr) && !/unable to extract|requested format|nsig|sabr/i.test(lastErr)) {
      break;
    }
  }

  const c = cookiesStatus();
  if (c.loaded && !c.hasLoginHints) {
    lastErr +=
      ' — cookie dosyasında LOGIN_INFO/PSID yok; incognito + robots.txt ile yeniden export et.';
  } else if (c.loaded && !proxy) {
    lastErr +=
      ' — cookie geçerli ama Hetzner IP bot sayılıyor. .env → YTDLP_PROXY=http://user:pass@residential-proxy:port ekle.';
  } else if (c.loaded && proxy) {
    lastErr += ' — cookie+proxy ile de reddedildi; proxy residential mi kontrol et / cookie yenile.';
  }

  throw new Error(lastErr);
}

export function openPcmStream(source: string): {
  ffmpeg: ReturnType<typeof spawn>;
  ytdlp: ReturnType<typeof spawn>;
} {
  ensureCookiesFile();
  const hasCookies = cookiesStatus().loaded;
  const extractorArgs =
    workingExtractorArgs ||
    process.env.YTDLP_EXTRACTOR_ARGS?.trim() ||
    (hasCookies ? COOKIE_CLIENTS[0]! : ANON_CLIENTS[0]!);
  const opts: RunOpts = {
    extractorArgs,
    impersonate: workingImpersonate || process.env.YTDLP_IMPERSONATE === '1',
    needJs: /player_client=(web|mweb|web_safari)\b/.test(extractorArgs),
    skipCookies: workingSkipCookies,
  };

  const ytdlp = spawn(
    ytdlpBin(),
    ['-f', 'bestaudio/best', '-o', '-', '--quiet', ...buildCommonArgs(opts), source],
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
