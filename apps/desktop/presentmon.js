/**
 * Oyun FPS'i (yalnız Windows) — Intel PresentMon (MIT) ile.
 *
 * PresentMon ETW izine bakar; yönetici ya da "Performance Log Users" grubu ister.
 * Yöneticiyle her seferinde çalıştırmak yerine: önce normal çalıştır; erişim yoksa
 * kullanıcı bir kez "Etkinleştir"e basar → kullanıcı gruba eklenir (tek UAC) →
 * sonraki oturum açılışından itibaren izinsiz çalışır. Süreç uygulamanın çocuğudur,
 * her zaman durdurulabilir.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/** FPS sayılmayacak süreçler (masaüstü, tarayıcılar, Dracord'un kendisi) */
const IGNORE = new Set(
  [
    'dwm.exe',
    'dracord.exe',
    'explorer.exe',
    'chrome.exe',
    'msedge.exe',
    'firefox.exe',
    'opera.exe',
    'brave.exe',
    'discord.exe',
    'steamwebhelper.exe',
    'searchhost.exe',
    'startmenuexperiencehost.exe',
    'shellexperiencehost.exe',
    'textinputhost.exe',
    'applicationframehost.exe',
    'nvidia overlay.exe',
    'presentmon.exe',
  ].map((s) => s.toLowerCase()),
);

const WINDOW_SEC = 2;

/**
 * Saf CSV ayrıştırıcı + pencere: satır satır besle, `current()` en çok kare sunan
 * oyunu ve FPS'ini döndürür.
 */
function createFpsTracker(now = () => Date.now()) {
  let cols = null;
  /** app -> [{t, ms}] */
  const frames = new Map();
  let lastAt = 0;

  function header(line) {
    const names = line.split(',').map((s) => s.trim().toLowerCase());
    const app = names.indexOf('application');
    const t = names.indexOf('timeinseconds');
    let ms = names.indexOf('msbetweenpresents');
    if (ms < 0) ms = names.indexOf('frametime');
    if (app < 0 || ms < 0) return null;
    return { app, t, ms, n: names.length };
  }

  function push(line) {
    if (!line || !line.trim()) return;
    if (!cols) {
      cols = header(line);
      return;
    }
    if (/^application,/i.test(line)) {
      cols = header(line);
      return;
    }
    const parts = line.split(',');
    if (parts.length < cols.n - 1) return;
    const app = String(parts[cols.app] || '').trim();
    if (!app || IGNORE.has(app.toLowerCase())) return;
    const ms = Number(parts[cols.ms]);
    if (!Number.isFinite(ms) || ms <= 0 || ms > 2000) return;
    const at = now();
    lastAt = at;
    let list = frames.get(app);
    if (!list) frames.set(app, (list = []));
    list.push({ at, ms });
  }

  function prune() {
    const cut = now() - WINDOW_SEC * 1000;
    for (const [k, list] of frames) {
      while (list.length && list[0].at < cut) list.shift();
      if (!list.length) frames.delete(k);
    }
  }

  /** @returns {{ app: string, fps: number } | null} */
  function current() {
    prune();
    let best = null;
    for (const [app, list] of frames) {
      if (list.length < 3) continue;
      if (!best || list.length > best.list.length) best = { app, list };
    }
    if (!best) return null;
    const avg = best.list.reduce((a, f) => a + f.ms, 0) / best.list.length;
    return { app: best.app.replace(/\.exe$/i, ''), fps: Math.round(1000 / avg) };
  }

  return { push, current, get lastAt() { return lastAt; } };
}

function exePath() {
  const packed = process.resourcesPath ? path.join(process.resourcesPath, 'presentmon', 'PresentMon.exe') : '';
  if (packed && fs.existsSync(packed)) return packed;
  const dev = path.join(__dirname, 'vendor', 'presentmon', 'PresentMon.exe');
  return fs.existsSync(dev) ? dev : null;
}

/** 'off' | 'unsupported' | 'starting' | 'running' | 'needs_setup' | 'error' */
let status = process.platform === 'win32' ? 'off' : 'unsupported';
let lastError = null;
let child = null;
let tracker = null;
let restartTimer = null;
let wanted = false;

function start() {
  wanted = true;
  if (process.platform !== 'win32' || child) return;
  const exe = exePath();
  if (!exe) {
    status = 'error';
    lastError = 'PresentMon bulunamadı';
    return;
  }
  status = 'starting';
  tracker = createFpsTracker();
  let errText = '';
  let buf = '';
  try {
    child = spawn(
      exe,
      [
        '--output_stdout',
        '--v1_metrics',
        '--no_console_stats',
        '--session_name',
        'DracordFPS',
        '--stop_existing_session',
        '--exclude',
        'Dracord.exe',
        '--exclude',
        'dwm.exe',
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (e) {
    status = 'error';
    lastError = String((e && e.message) || e).slice(0, 200);
    child = null;
    return;
  }
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      tracker.push(buf.slice(0, i).replace(/\r$/, ''));
      buf = buf.slice(i + 1);
    }
    if (buf.length > 65536) buf = '';
    status = 'running';
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => {
    errText = (errText + d).slice(-2000);
  });
  child.on('exit', (code) => {
    child = null;
    if (/Performance Log Users|access is denied|administrator|elevat/i.test(errText)) {
      status = 'needs_setup';
      lastError = null;
      return;
    }
    if (!wanted) {
      status = 'off';
      return;
    }
    status = 'error';
    lastError = (errText.trim().split(/\r?\n/).pop() || `çıkış kodu ${code}`).slice(0, 200);
    // geçici hata: 15 sn sonra bir kez daha dene
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (wanted && !child && status === 'error') start();
    }, 15_000);
  });
}

function stop() {
  wanted = false;
  clearTimeout(restartTimer);
  if (child) {
    try {
      child.kill();
    } catch {
      /* zaten kapanmış */
    }
    child = null;
  }
  if (status !== 'unsupported' && status !== 'needs_setup') status = 'off';
  tracker = null;
}

/** @returns {{ app: string, fps: number } | null} */
function currentFps() {
  if (!tracker || status !== 'running') return null;
  return tracker.current();
}

function getStatus() {
  return { status, error: lastError };
}

/**
 * Kullanıcıyı "Performance Log Users" grubuna ekle (tek seferlik yönetici izni).
 * Grup adı Windows diline göre değişir → SID (S-1-5-32-559) ile çözülür.
 */
function setupPermission() {
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, error: 'Yalnız Windows' });
  const user = `${process.env.USERDOMAIN || ''}\\${process.env.USERNAME || ''}`.replace(/^\\/, '');
  if (!process.env.USERNAME) return Promise.resolve({ ok: false, error: 'Kullanıcı adı alınamadı' });
  const inner = [
    "$g = (New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-559')).Translate([System.Security.Principal.NTAccount]).Value.Split('\\\\')[-1]",
    `Add-LocalGroupMember -Group $g -Member '${user.replace(/'/g, "''")}' -ErrorAction SilentlyContinue`,
  ].join('; ');
  const encoded = Buffer.from(inner, 'utf16le').toString('base64');
  const outer = `Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-NoProfile','-EncodedCommand','${encoded}'`;
  return new Promise((resolve) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-Command', outer], { windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('exit', (code) => {
      if (code === 0) resolve({ ok: true, needsSignOut: true });
      else resolve({ ok: false, error: /cancel|iptal/i.test(err) ? 'İzin verilmedi' : err.trim().slice(0, 200) || `çıkış kodu ${code}` });
    });
    p.on('error', (e) => resolve({ ok: false, error: String(e.message || e) }));
  });
}

module.exports = { start, stop, currentFps, getStatus, setupPermission, createFpsTracker };
