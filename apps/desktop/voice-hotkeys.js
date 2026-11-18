/**
 * A8 — voice hotkeys that work while another app (a game) has focus.
 *
 * - Mute / deafen toggles: Electron globalShortcut, registered only while in a voice room
 *   (so the key combination is not taken from other apps the rest of the time).
 * - Push-to-talk (Windows): a small PowerShell loop polls user32 GetAsyncKeyState every
 *   ~15 ms for the bound virtual keys and prints 1 / 0 when the hold state changes. No
 *   native module, no keyboard hook (anti-cheat friendly: read-only key state). The loop
 *   exits on its own when Dracord's process is gone.
 * - macOS / Linux: no global push-to-talk here; the window's own key events still work.
 */
const { spawn } = require('child_process');
const { globalShortcut } = require('electron');

/** @type {import('child_process').ChildProcessWithoutNullStreams | null} */
let watcher = null;
let watcherKey = '';
/** @type {string[]} */
let registered = [];
/** @type {(channel: string, payload: unknown) => void} */
let send = () => {};

function psScript(vks) {
  const list = vks.map((v) => `0x${v.toString(16)}`).join(',');
  return String.raw`
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DracordPtt {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
}
"@
$vks = @(${list})
$parent = ${process.pid}
$held = $false
$n = 0
[Console]::Out.WriteLine('ready')
while ($true) {
  $all = $true
  foreach ($vk in $vks) { if (([DracordPtt]::GetAsyncKeyState($vk) -band 0x8000) -eq 0) { $all = $false; break } }
  if ($all -ne $held) {
    $held = $all
    if ($held) { [Console]::Out.WriteLine('1') } else { [Console]::Out.WriteLine('0') }
    [Console]::Out.Flush()
  }
  $n++
  if ($n -ge 130) {
    $n = 0
    if (-not (Get-Process -Id $parent -ErrorAction SilentlyContinue)) { exit 0 }
  }
  [System.Threading.Thread]::Sleep(15)
}
`;
}

function stopWatcher() {
  if (!watcher) return;
  try {
    watcher.kill();
  } catch {
    /* already gone */
  }
  watcher = null;
  watcherKey = '';
  send('voice:ptt', { held: false });
}

/** @param {number[]} vks */
function startWatcher(vks) {
  const key = vks.join(',');
  if (watcher && watcherKey === key) return;
  stopWatcher();
  if (process.platform !== 'win32' || vks.length === 0) return;
  const valid = vks.filter((v) => Number.isInteger(v) && v > 0 && v < 256).slice(0, 5);
  if (valid.length === 0) return;
  const encoded = Buffer.from(psScript(valid), 'utf16le').toString('base64');
  let proc;
  try {
    proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    console.warn('[voice-hotkeys] watcher', err);
    return;
  }
  watcher = proc;
  watcherKey = key;
  let buf = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line === '1' || line === '0') send('voice:ptt', { held: line === '1' });
      else if (line === 'ready') send('voice:ptt-ready', { ok: true });
    }
  });
  proc.stderr.on('data', (d) => console.warn('[voice-hotkeys]', String(d).slice(0, 300)));
  proc.on('exit', () => {
    if (watcher !== proc) return;
    watcher = null;
    watcherKey = '';
    send('voice:ptt', { held: false });
  });
}

function unregisterToggles() {
  for (const accel of registered) {
    try {
      globalShortcut.unregister(accel);
    } catch {
      /* not registered */
    }
  }
  registered = [];
}

/** a plausible Electron accelerator from the renderer (the renderer builds it from a key binding) */
function safeAccel(raw) {
  if (typeof raw !== 'string' || raw.length > 64) return null;
  return /^[A-Za-z0-9+`\-=[\]\\;',./]+$/.test(raw) ? raw : null;
}

/**
 * @param {{ active?: boolean, pttVks?: number[] | null, muteAccel?: string | null, deafenAccel?: string | null }} cfg
 * @returns {{ ok: boolean, globalPtt: boolean, failed: string[] }}
 */
function configure(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  unregisterToggles();
  const failed = [];
  if (!c.active) {
    stopWatcher();
    return { ok: true, globalPtt: false, failed };
  }
  const toggles = [
    ['mute', safeAccel(c.muteAccel)],
    ['deafen', safeAccel(c.deafenAccel)],
  ];
  for (const [action, accel] of toggles) {
    if (!accel) continue;
    try {
      const ok = globalShortcut.register(accel, () => send('voice:hotkey', { action }));
      if (ok) registered.push(accel);
      else failed.push(action); // another app already owns it
    } catch {
      failed.push(action);
    }
  }
  const vks = Array.isArray(c.pttVks) ? c.pttVks.map(Number) : [];
  if (vks.length) startWatcher(vks);
  else stopWatcher();
  return { ok: true, globalPtt: process.platform === 'win32' && vks.length > 0, failed };
}

/**
 * @param {{ ipcMain: import('electron').IpcMain, getMainWindow: () => import('electron').BrowserWindow | null }} deps
 */
function registerVoiceHotkeys({ ipcMain, getMainWindow }) {
  send = (channel, payload) => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send(channel, payload);
    } catch {
      /* window closing */
    }
  };
  ipcMain.handle('voice-hotkeys:configure', (_e, cfg) => configure(cfg));
}

function shutdownVoiceHotkeys() {
  unregisterToggles();
  stopWatcher();
}

module.exports = { registerVoiceHotkeys, shutdownVoiceHotkeys };
