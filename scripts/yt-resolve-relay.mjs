#!/usr/bin/env node
/**
 * Ev PC YouTube relay — Hetzner hic YouTube'a dokunmaz.
 * /resolve → metadata + kisa omurlu /audio/<token>
 * /audio/<token> → yt-dlp ses baytlari (ev IP + cookie)
 *
 *   powershell -ExecutionPolicy Bypass -File scripts/start-yt-relay.ps1
 *   cloudflared tunnel --url http://127.0.0.1:8791
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = Number(process.env.YTDLP_RELAY_PORT || 8791);
const SECRET = (process.env.YTDLP_RELAY_SECRET || '').trim();
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const COOKIES =
  process.env.YTDLP_COOKIES_FILE ||
  resolve(process.cwd(), 'youtube-cookies.txt');
const TOKEN_TTL_MS = 20 * 60 * 1000;

/** @type {Map<string, { url: string; expires: number }>} */
const tokens = new Map();

function purgeTokens() {
  const now = Date.now();
  for (const [k, v] of tokens) {
    if (v.expires < now) tokens.delete(k);
  }
}

function runYtdlp(args) {
  return new Promise((resolvePromise) => {
    const child = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('error', (e) => resolvePromise({ code: 1, out, err: e.message }));
    child.on('close', (code) => resolvePromise({ code, out, err }));
  });
}

/** PC'de kanitlanan kombinasyon: cookies + impersonate; extractor-args zorlama */
function buildArgs(extra, url) {
  const args = ['--no-playlist', '--no-warnings', ...extra];
  if (existsSync(COOKIES)) args.push('--cookies', COOKIES);
  // Varsayilan impersonate acik (YTDLP_IMPERSONATE=0 ile kapat)
  if (process.env.YTDLP_IMPERSONATE !== '0') {
    args.push('--impersonate', process.env.YTDLP_IMPERSONATE_BROWSER || 'chrome');
  }
  const extractor = process.env.YTDLP_EXTRACTOR_ARGS?.trim();
  if (extractor) args.push('--extractor-args', extractor);
  args.push(url);
  return args;
}

function summarizeErr(err) {
  const line = (err || '')
    .split(/\r?\n/)
    .reverse()
    .find((l) => /ERROR:|Sign in|bot|reload/i.test(l));
  return (line || err || 'yt-dlp failed').replace(/^ERROR:\s*/i, '').slice(0, 240);
}

async function resolveMeta(url) {
  const metaRes = await runYtdlp(buildArgs(['-j', '-f', 'bestaudio/best'], url));
  if (metaRes.code !== 0 || !metaRes.out.trim()) {
    throw new Error(summarizeErr(metaRes.err));
  }
  const j = JSON.parse(metaRes.out.trim().split('\n')[0]);
  purgeTokens();
  const token = randomBytes(16).toString('hex');
  tokens.set(token, { url, expires: Date.now() + TOKEN_TTL_MS });
  return {
    title: j.title || 'Unknown',
    webpage_url: j.webpage_url || url,
    duration: typeof j.duration === 'number' ? j.duration : undefined,
    thumbnail: j.thumbnail || j.thumbnails?.at?.(-1)?.url,
    // Sunucu bu yolu ceker; YouTube CDN'ye Hetzner gitmez
    stream_path: `/audio/${token}`,
  };
}

function readJson(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function authOk(req) {
  if (!SECRET) return true;
  const h = req.headers.authorization || '';
  const bearer = h.startsWith('Bearer ') ? h.slice(7) : '';
  const alt = req.headers['x-relay-secret'] || '';
  const q = new URL(req.url || '/', 'http://127.0.0.1').searchParams.get('secret') || '';
  return bearer === SECRET || alt === SECRET || q === SECRET;
}

function pipeAudio(res, sourceUrl) {
  const args = buildArgs(['-f', 'bestaudio/best', '-o', '-', '--quiet'], sourceUrl);
  const child = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  child.stdout.pipe(res);
  let err = '';
  child.stderr.on('data', (d) => {
    err += d.toString();
  });
  const kill = () => {
    try {
      child.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  };
  res.on('close', kill);
  child.on('close', (code) => {
    if (code && code !== 0 && !res.headersSent) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: summarizeErr(err) }));
    } else if (!res.writableEnded) {
      res.end();
    }
  });
  child.on('error', (e) => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: e.message }));
    } else {
      res.destroy();
    }
  });
}

const server = createServer(async (req, res) => {
  const u = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && u.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        ok: true,
        cookies: existsSync(COOKIES),
        tokens: tokens.size,
        mode: 'audio-proxy',
      }),
    );
    return;
  }

  if (req.method === 'POST' && (u.pathname === '/resolve' || u.pathname === '/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!authOk(req)) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    try {
      const body = await readJson(req);
      const url = String(body.url || body.source || '').trim();
      if (!url) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'url required' }));
        return;
      }
      const data = await resolveMeta(url);
      console.log(`[ok] ${data.title} → ${data.stream_path}`);
      res.end(JSON.stringify(data));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[fail] ${msg}`);
      res.statusCode = 502;
      res.end(JSON.stringify({ error: msg }));
    }
    return;
  }

  const audioMatch = u.pathname.match(/^\/audio\/([a-f0-9]+)$/i);
  if (req.method === 'GET' && audioMatch) {
    if (!authOk(req)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    purgeTokens();
    const entry = tokens.get(audioMatch[1]);
    if (!entry) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'token expired or unknown — resolve again' }));
      return;
    }
    console.log(`[audio] ${entry.url}`);
    pipeAudio(res, entry.url);
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`yt-resolve-relay http://127.0.0.1:${PORT} (audio-proxy mode)`);
  console.log(`cookies: ${existsSync(COOKIES) ? COOKIES : 'MISSING'}`);
  console.log(`yt-dlp: ${YTDLP}`);
  if (!SECRET) console.warn('UYARI: YTDLP_RELAY_SECRET bos');
});
