/**
 * Windows uzak kontrol — kalıcı PowerShell ile SendInput / SetCursorPos.
 * macOS: osascript tıklama (sınırlı). Diğer platformlar: no-op.
 */
const { spawn } = require('child_process');
const { screen } = require('electron');

/** @type {import('child_process').ChildProcessWithoutNullStreams | null} */
let ps = null;
let ready = false;
const queue = [];

const PS_BOOT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DracordRC {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, int e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;
  public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
  public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
  public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
  public const uint MOUSEEVENTF_WHEEL = 0x0800;
  public const uint KEYEVENTF_KEYUP = 0x0002;
}
"@
Write-Output READY
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line -eq 'QUIT') { break }
  try {
    $j = $line | ConvertFrom-Json
    if ($j.op -eq 'move') { [DracordRC]::SetCursorPos([int]$j.x, [int]$j.y) | Out-Null }
    elseif ($j.op -eq 'down') {
      [DracordRC]::SetCursorPos([int]$j.x, [int]$j.y) | Out-Null
      if ($j.button -eq 2) { [DracordRC]::mouse_event([DracordRC]::MOUSEEVENTF_RIGHTDOWN,0,0,0,0) }
      elseif ($j.button -eq 1) { [DracordRC]::mouse_event([DracordRC]::MOUSEEVENTF_MIDDLEDOWN,0,0,0,0) }
      else { [DracordRC]::mouse_event([DracordRC]::MOUSEEVENTF_LEFTDOWN,0,0,0,0) }
    }
    elseif ($j.op -eq 'up') {
      [DracordRC]::SetCursorPos([int]$j.x, [int]$j.y) | Out-Null
      if ($j.button -eq 2) { [DracordRC]::mouse_event([DracordRC]::MOUSEEVENTF_RIGHTUP,0,0,0,0) }
      elseif ($j.button -eq 1) { [DracordRC]::mouse_event([DracordRC]::MOUSEEVENTF_MIDDLEUP,0,0,0,0) }
      else { [DracordRC]::mouse_event([DracordRC]::MOUSEEVENTF_LEFTUP,0,0,0,0) }
    }
    elseif ($j.op -eq 'wheel') {
      [DracordRC]::SetCursorPos([int]$j.x, [int]$j.y) | Out-Null
      $d = [uint32]([math]::Max(-1200, [math]::Min(1200, [int]$j.delta)))
      [DracordRC]::mouse_event([DracordRC]::MOUSEEVENTF_WHEEL,0,0,$d,0)
    }
    elseif ($j.op -eq 'key') {
      $vk = [byte]([int]$j.vk)
      if ($j.down) { [DracordRC]::keybd_event($vk,0,0,0) }
      else { [DracordRC]::keybd_event($vk,0,[DracordRC]::KEYEVENTF_KEYUP,0) }
    }
  } catch {}
}
`;

function ensurePs() {
  if (process.platform !== 'win32') return false;
  if (ps && !ps.killed) return true;
  ready = false;
  ps = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', PS_BOOT],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  );
  ps.stdout.on('data', (buf) => {
    if (String(buf).includes('READY')) {
      ready = true;
      while (queue.length) {
        const line = queue.shift();
        try {
          ps.stdin.write(line + '\n');
        } catch {
          /* ignore */
        }
      }
    }
  });
  ps.on('exit', () => {
    ps = null;
    ready = false;
  });
  return true;
}

function send(cmd) {
  if (process.platform !== 'win32') return { ok: false, error: 'unsupported_platform' };
  if (!ensurePs()) return { ok: false, error: 'spawn_failed' };
  const line = JSON.stringify(cmd);
  if (!ready) {
    queue.push(line);
    if (queue.length > 80) queue.shift();
    return { ok: true, queued: true };
  }
  try {
    ps.stdin.write(line + '\n');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'write_failed' };
  }
}

/** Web key → Windows VK */
const VK = {
  Backspace: 0x08,
  Tab: 0x09,
  Enter: 0x0d,
  Escape: 0x1b,
  Space: 0x20,
  ArrowLeft: 0x25,
  ArrowUp: 0x26,
  ArrowRight: 0x27,
  ArrowDown: 0x28,
  Delete: 0x2e,
  Home: 0x24,
  End: 0x23,
  PageUp: 0x21,
  PageDown: 0x22,
};

function keyToVk(key, code) {
  if (key && key.length === 1) {
    const c = key.toUpperCase();
    const codePoint = c.charCodeAt(0);
    if (codePoint >= 65 && codePoint <= 90) return codePoint;
    if (codePoint >= 48 && codePoint <= 57) return codePoint;
  }
  if (VK[key]) return VK[key];
  if (code && /^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
  if (code && /^Digit[0-9]$/.test(code)) return 0x30 + Number(code.slice(5));
  return null;
}

/**
 * @param {{ type: string, nx?: number, ny?: number, button?: number, deltaY?: number, key?: string, code?: string, keyAction?: string }} ev
 * @param {{ width: number, height: number, x?: number, y?: number } | null} bounds
 */
function injectRemoteInput(ev, bounds) {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'desktop_windows_only' };
  }
  const display = screen.getPrimaryDisplay();
  const b = bounds || {
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
  };
  const nx = Math.min(1, Math.max(0, Number(ev.nx) || 0));
  const ny = Math.min(1, Math.max(0, Number(ev.ny) || 0));
  const x = Math.round((b.x || 0) + nx * b.width);
  const y = Math.round((b.y || 0) + ny * b.height);

  if (ev.type === 'move') return send({ op: 'move', x, y });
  if (ev.type === 'down') return send({ op: 'down', x, y, button: ev.button ?? 0 });
  if (ev.type === 'up') return send({ op: 'up', x, y, button: ev.button ?? 0 });
  if (ev.type === 'wheel') {
    return send({
      op: 'wheel',
      x,
      y,
      delta: Math.round(-(Number(ev.deltaY) || 0)),
    });
  }
  if (ev.type === 'key') {
    const vk = keyToVk(ev.key, ev.code);
    if (vk == null) return { ok: false, error: 'unknown_key' };
    return send({
      op: 'key',
      vk,
      down: ev.keyAction !== 'up',
    });
  }
  return { ok: false, error: 'unknown_type' };
}

function disposeRemoteInput() {
  if (!ps) return;
  try {
    ps.stdin.write('QUIT\n');
  } catch {
    /* ignore */
  }
  try {
    ps.kill();
  } catch {
    /* ignore */
  }
  ps = null;
  ready = false;
}

module.exports = { injectRemoteInput, disposeRemoteInput };
