#!/usr/bin/env node
/**
 * Ev PC’sinde çalıştır — Hetzner’deki music-bot YouTube’u buradan çözer.
 *
 * Kurulum (Windows):
 *   1) yt-dlp + ffmpeg PATH’te olsun (winget install yt-dlp.yt-dlp)
 *   2) youtube-cookies.txt proje kökünde (encode script’ten önce export)
 *   3) node scripts/yt-resolve-relay.mjs
 *   4) cloudflared tunnel (veya port forward):
 *        cloudflared tunnel --url http://127.0.0.1:8791
 *   5) Sunucu .env:
 *        YTDLP_RELAY_URL=https://xxxx.trycloudflare.com
 *        YTDLP_RELAY_SECRET=uzun-rastgele-string
 *      music-bot recreate
 *
 * Env:
 *   YTDLP_RELAY_PORT=8791
 *   YTDLP_RELAY_SECRET=...
 *   YTDLP_COOKIES_FILE=./youtube-cookies.txt
 *   YTDLP_PATH=yt-dlp
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = Number(process.env.YTDLP_RELAY_PORT || 8791);
const SECRET = (process.env.YTDLP_RELAY_SECRET || '').trim();
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const COOKIES =
  process.env.YTDLP_COOKIES_FILE ||
  resolve(process.cwd(), 'youtube-cookies.txt');

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

function buildArgs(extra, url) {
  const args = ['--no-playlist', '--no-warnings', ...extra];
  if (existsSync(COOKIES)) {
    args.push('--cookies', COOKIES);
  }
  const extractor = process.env.YTDLP_EXTRACTOR_ARGS?.trim();
  if (extractor) args.push('--extractor-args', extractor);
  if (process.env.YTDLP_IMPERSONATE === '1') {
    args.push('--impersonate', process.env.YTDLP_IMPERSONATE_BROWSER || 'chrome');
  }
  args.push(url);
  return args;
}

async function resolveUrl(url) {
  const metaRes = await runYtdlp(buildArgs(['-j', '-f', 'bestaudio/best'], url));
  if (metaRes.code !== 0 || !metaRes.out.trim()) {
    const msg = (metaRes.err || metaRes.out || 'yt-dlp failed').split(/\r?\n/).reverse().find((l) => /ERROR:|Sign in|bot/i.test(l)) || metaRes.err.slice(0, 200);
    throw new Error(msg.replace(/^ERROR:\s*/i, '').slice(0, 240));
  }
  const j = JSON.parse(metaRes.out.trim().split('\n')[0]);
  let streamUrl = typeof j.url === 'string' ? j.url : null;
  if (!streamUrl && Array.isArray(j.requested_formats)) {
    const audio = j.requested_formats.find((f) => f.acodec && f.acodec !== 'none' && f.url);
    streamUrl = audio?.url || j.requested_formats[0]?.url || null;
  }
  if (!streamUrl && Array.isArray(j.formats)) {
    const audio = [...j.formats]
      .reverse()
      .find((f) => f.url && f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
    streamUrl = audio?.url || null;
  }
  if (!streamUrl) {
    const g = await runYtdlp(buildArgs(['-g', '-f', 'bestaudio/best'], url));
    streamUrl = g.out.trim().split(/\r?\n/).filter(Boolean).pop() || null;
  }
  if (!streamUrl) throw new Error('stream URL alınamadı');

  return {
    title: j.title || 'Unknown',
    webpage_url: j.webpage_url || url,
    duration: typeof j.duration === 'number' ? j.duration : undefined,
    thumbnail: j.thumbnail || j.thumbnails?.at?.(-1)?.url,
    stream_url: streamUrl,
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
  return bearer === SECRET || alt === SECRET;
}

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'GET' && req.url === '/health') {
    res.end(JSON.stringify({ ok: true, cookies: existsSync(COOKIES) }));
    return;
  }
  if (req.method === 'POST' && (req.url === '/resolve' || req.url === '/')) {
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
      const data = await resolveUrl(url);
      console.log(`[ok] ${data.title}`);
      res.end(JSON.stringify(data));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[fail] ${msg}`);
      res.statusCode = 502;
      res.end(JSON.stringify({ error: msg }));
    }
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`yt-resolve-relay http://127.0.0.1:${PORT}`);
  console.log(`cookies: ${existsSync(COOKIES) ? COOKIES : 'MISSING — export youtube-cookies.txt'}`);
  if (!SECRET) console.warn('UYARI: YTDLP_RELAY_SECRET boş — herkese açık kalır');
});
