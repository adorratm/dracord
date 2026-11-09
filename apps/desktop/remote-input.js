/**
 * Windows uzak kontrol — kalıcı PowerShell + user32 SendInput.
 *
 * - Per-monitor DPI aware (v2): koordinatlar fiziksel piksel; %125/%150 ölçeklemede kayma yok.
 * - Hedef: paylaşılan EKRAN (display bounds) veya PENCERE (DWM görünür sınırları, her olayda güncel).
 * - Klavye: KeyboardEvent.code → scancode (layout bağımsız; TR-Q / ğüşıöç doğru tuşa düşer).
 *   code bilinmiyorsa tek karakter için KEYEVENTF_UNICODE.
 * - Satır tabanlı metin protokolü (JSON parse yok → düşük gecikme).
 * - setEnabled(false): sunucu yanıtını beklemeden yerel olarak inject'i anında keser (acil durdurma).
 * macOS: remote-input-mac.js (JXA + CGEvent, Erişilebilirlik izni). Linux: desteklenmiyor.
 */
const { spawn } = require('child_process');
const { screen, systemPreferences } = require('electron');
const mac = process.platform === 'darwin' ? require('./remote-input-mac') : null;

/** @type {import('child_process').ChildProcessWithoutNullStreams | null} */
let ps = null;
let ready = false;
/** @type {string[]} */
const queue = [];
let enabled = true;
/** @type {{ id: string, displayId?: string } | null} */
let shareSource = null;
/** @type {{ x: number, y: number, width: number, height: number } | null} */
let rendererBounds = null;
let lastTargetLine = '';
/** Paylaşanın fiziksel faresi kontrolü devraldığında (main → renderer bildirimi) */
/** @type {(() => void) | null} */
let onUserOverride = null;
function setUserOverrideListener(fn) {
  onUserOverride = typeof fn === 'function' ? fn : null;
}
/** Basılı tuşlar (scancode|ext) — devre dışı kalınca hepsini bırak */
const pressed = new Set();

const PS_BOOT = String.raw`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DracordRC {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L; public int T; public int R; public int B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION u; }
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] i, int size);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
  public static int TX, TY, TW = 1920, TH = 1080; public static IntPtr HW = IntPtr.Zero;
  static void Rect() {
    if (HW == IntPtr.Zero || !IsWindow(HW)) return;
    RECT r;
    if (DwmGetWindowAttribute(HW, 9, out r, Marshal.SizeOf(typeof(RECT))) != 0) GetWindowRect(HW, out r);
    TX = r.L; TY = r.T; TW = Math.Max(1, r.R - r.L); TH = Math.Max(1, r.B - r.T);
  }
  // Fiziksel fare önceliği: paylaşan kendi faresini oynatırsa uzaktan hareket 1,5 sn duraklar
  public static int LX = int.MinValue, LY = 0; public static long PauseUntil = 0; public static bool Notify = false;
  static long Now() { return DateTime.UtcNow.Ticks / 10000; }
  public static bool Pos(int nx, int ny) {
    long now = Now();
    if (now < PauseUntil) return false;
    POINT c;
    if (LX != int.MinValue && GetCursorPos(out c) && (Math.Abs(c.X - LX) > 12 || Math.Abs(c.Y - LY) > 12)) {
      PauseUntil = now + 1500; LX = int.MinValue; Notify = true; return false;
    }
    Rect();
    int x = TX + (int)Math.Round(nx / 1000000.0 * (TW - 1));
    int y = TY + (int)Math.Round(ny / 1000000.0 * (TH - 1));
    SetCursorPos(x, y);
    LX = x; LY = y;
    return true;
  }
  static void Send(INPUT i) { SendInput(1, new INPUT[] { i }, Marshal.SizeOf(typeof(INPUT))); }
  public static void Mouse(uint flags, int data) {
    INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = flags; i.u.mi.mouseData = unchecked((uint)data); Send(i);
  }
  public static void Key(ushort sc, bool ext, bool up) {
    INPUT i = new INPUT(); i.type = 1; i.u.ki.wScan = sc;
    i.u.ki.dwFlags = 0x0008u | (ext ? 0x0001u : 0u) | (up ? 0x0002u : 0u); Send(i);
  }
  public static void Uni(ushort ch) {
    INPUT a = new INPUT(); a.type = 1; a.u.ki.wScan = ch; a.u.ki.dwFlags = 0x0004; Send(a);
    INPUT b = new INPUT(); b.type = 1; b.u.ki.wScan = ch; b.u.ki.dwFlags = 0x0004 | 0x0002; Send(b);
  }
}
"@
try { [DracordRC]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null } catch {}
Write-Output READY
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line -eq 'Q') { break }
  try {
    $p = $line.Split(' ')
    switch ($p[0]) {
      'S' { [DracordRC]::HW = [IntPtr]::Zero; [DracordRC]::TX = [int]$p[1]; [DracordRC]::TY = [int]$p[2]; [DracordRC]::TW = [int]$p[3]; [DracordRC]::TH = [int]$p[4] }
      'W' { [DracordRC]::HW = [IntPtr][long]$p[1] }
      'm' { [void][DracordRC]::Pos([int]$p[1], [int]$p[2]) }
      'd' { if ([DracordRC]::Pos([int]$p[1], [int]$p[2])) { [DracordRC]::Mouse([uint32]$p[3], 0) } }
      'u' { [void][DracordRC]::Pos([int]$p[1], [int]$p[2]); [DracordRC]::Mouse([uint32]$p[3], 0) }
      'w' { if ([DracordRC]::Pos([int]$p[1], [int]$p[2])) { [DracordRC]::Mouse([uint32]2048, [int]$p[3]) } }
      'k' { [DracordRC]::Key([uint16]$p[1], $p[2] -eq '1', $p[3] -eq '1') }
      'c' { [DracordRC]::Uni([uint16]$p[1]) }
    }
    if ([DracordRC]::Notify) { [DracordRC]::Notify = $false; [Console]::Out.WriteLine('U'); [Console]::Out.Flush() }
  } catch {}
}
`;

function ensurePs() {
  if (process.platform !== 'win32') return false;
  if (ps && !ps.killed) return true;
  ready = false;
  lastTargetLine = '';
  ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', PS_BOOT], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  ps.stdout.on('data', (buf) => {
    const text = String(buf);
    if (ready && /(^|\n)U\r?(\n|$)/.test(text)) {
      try {
        onUserOverride?.();
      } catch {
        /* ignore */
      }
    }
    if (!ready && text.includes('READY')) {
      ready = true;
      while (queue.length) write(queue.shift());
    }
  });
  ps.on('exit', () => {
    ps = null;
    ready = false;
    lastTargetLine = '';
  });
  return true;
}

function write(line) {
  try {
    ps?.stdin.write(line + '\n');
    return true;
  } catch {
    return false;
  }
}

function send(line) {
  if (!ensurePs()) return { ok: false, error: 'spawn_failed' };
  if (!ready) {
    queue.push(line);
    if (queue.length > 120) queue.shift();
    return { ok: true, queued: true };
  }
  return write(line) ? { ok: true } : { ok: false, error: 'write_failed' };
}

/** Paylaşılan kaynağın hedef satırı: ekran → fiziksel display rect, pencere → HWND */
function targetLine() {
  const id = shareSource?.id || '';
  const m = /^window:(\d+):/.exec(id);
  if (m) return `W ${m[1]}`;
  let display = null;
  const all = screen.getAllDisplays();
  if (shareSource?.displayId) {
    display = all.find((d) => String(d.id) === String(shareSource.displayId)) || null;
  }
  if (!display && rendererBounds) {
    display = screen.getDisplayMatching({
      x: Math.round(rendererBounds.x),
      y: Math.round(rendererBounds.y),
      width: Math.max(1, Math.round(rendererBounds.width)),
      height: Math.max(1, Math.round(rendererBounds.height)),
    });
  }
  if (!display) display = screen.getPrimaryDisplay();
  let r = display.bounds;
  try {
    // Windows: DIP → fiziksel piksel (DPI ölçekleme)
    if (typeof screen.dipToScreenRect === 'function') r = screen.dipToScreenRect(null, display.bounds);
  } catch {
    /* ignore */
  }
  return `S ${Math.round(r.x)} ${Math.round(r.y)} ${Math.max(1, Math.round(r.width))} ${Math.max(1, Math.round(r.height))}`;
}

function ensureTarget() {
  const t = targetLine();
  if (t !== lastTargetLine) {
    const res = send(t);
    if (res.ok) lastTargetLine = t;
  }
}

/** KeyboardEvent.code → [scancode, extended] (Set 1) */
const SC = {
  Escape: [0x01], Digit1: [0x02], Digit2: [0x03], Digit3: [0x04], Digit4: [0x05], Digit5: [0x06],
  Digit6: [0x07], Digit7: [0x08], Digit8: [0x09], Digit9: [0x0a], Digit0: [0x0b], Minus: [0x0c],
  Equal: [0x0d], Backspace: [0x0e], Tab: [0x0f], KeyQ: [0x10], KeyW: [0x11], KeyE: [0x12],
  KeyR: [0x13], KeyT: [0x14], KeyY: [0x15], KeyU: [0x16], KeyI: [0x17], KeyO: [0x18], KeyP: [0x19],
  BracketLeft: [0x1a], BracketRight: [0x1b], Enter: [0x1c], ControlLeft: [0x1d], KeyA: [0x1e],
  KeyS: [0x1f], KeyD: [0x20], KeyF: [0x21], KeyG: [0x22], KeyH: [0x23], KeyJ: [0x24], KeyK: [0x25],
  KeyL: [0x26], Semicolon: [0x27], Quote: [0x28], Backquote: [0x29], ShiftLeft: [0x2a],
  Backslash: [0x2b], KeyZ: [0x2c], KeyX: [0x2d], KeyC: [0x2e], KeyV: [0x2f], KeyB: [0x30],
  KeyN: [0x31], KeyM: [0x32], Comma: [0x33], Period: [0x34], Slash: [0x35], ShiftRight: [0x36],
  NumpadMultiply: [0x37], AltLeft: [0x38], Space: [0x39], CapsLock: [0x3a], F1: [0x3b], F2: [0x3c],
  F3: [0x3d], F4: [0x3e], F5: [0x3f], F6: [0x40], F7: [0x41], F8: [0x42], F9: [0x43], F10: [0x44],
  NumLock: [0x45, 1], ScrollLock: [0x46], Numpad7: [0x47], Numpad8: [0x48], Numpad9: [0x49],
  NumpadSubtract: [0x4a], Numpad4: [0x4b], Numpad5: [0x4c], Numpad6: [0x4d], NumpadAdd: [0x4e],
  Numpad1: [0x4f], Numpad2: [0x50], Numpad3: [0x51], Numpad0: [0x52], NumpadDecimal: [0x53],
  IntlBackslash: [0x56], F11: [0x57], F12: [0x58],
  NumpadEnter: [0x1c, 1], ControlRight: [0x1d, 1], NumpadDivide: [0x35, 1], PrintScreen: [0x37, 1],
  AltRight: [0x38, 1], Home: [0x47, 1], ArrowUp: [0x48, 1], PageUp: [0x49, 1], ArrowLeft: [0x4b, 1],
  ArrowRight: [0x4d, 1], End: [0x4f, 1], ArrowDown: [0x50, 1], PageDown: [0x51, 1], Insert: [0x52, 1],
  Delete: [0x53, 1], MetaLeft: [0x5b, 1], MetaRight: [0x5c, 1], ContextMenu: [0x5d, 1],
};
/** code yoksa key adından (mobil sanal klavye vb.) */
const KEY_TO_CODE = {
  Escape: 'Escape', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab', ' ': 'Space',
  ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
  Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  Shift: 'ShiftLeft', Control: 'ControlLeft', Alt: 'AltLeft', Meta: 'MetaLeft',
};

const MOUSE_DOWN = { 0: 0x0002, 1: 0x0020, 2: 0x0008 };
const MOUSE_UP = { 0: 0x0004, 1: 0x0040, 2: 0x0010 };

function norm(v) {
  const n = Math.min(1, Math.max(0, Number(v) || 0));
  return Math.round(n * 1_000_000);
}

/**
 * @param {{ type: string, nx?: number, ny?: number, button?: number, deltaY?: number, key?: string, code?: string, keyAction?: string }} ev
 */
/** macOS: paylaşılan ekranın global (DIP) dikdörtgeni */
function macTargetRect() {
  const all = screen.getAllDisplays();
  let d = null;
  if (shareSource?.displayId) d = all.find((x) => String(x.id) === String(shareSource.displayId)) || null;
  if (!d && rendererBounds) {
    d = screen.getDisplayMatching({
      x: Math.round(rendererBounds.x),
      y: Math.round(rendererBounds.y),
      width: Math.max(1, Math.round(rendererBounds.width)),
      height: Math.max(1, Math.round(rendererBounds.height)),
    });
  }
  return (d || screen.getPrimaryDisplay()).bounds;
}

function injectRemoteInput(ev) {
  if (!enabled) return { ok: false, error: 'disabled' };
  if (process.platform === 'darwin' && mac) {
    if (shareSource?.id && /^window:/.test(shareSource.id)) return { ok: false, error: 'mac_window_share_unsupported' };
    return mac.injectMac(ev, macTargetRect(), systemPreferences);
  }
  if (process.platform !== 'win32') return { ok: false, error: 'unsupported_platform' };
  ensureTarget();
  const x = norm(ev.nx);
  const y = norm(ev.ny);
  switch (ev.type) {
    case 'move':
      return send(`m ${x} ${y}`);
    case 'down':
      return send(`d ${x} ${y} ${MOUSE_DOWN[ev.button ?? 0] ?? MOUSE_DOWN[0]}`);
    case 'up':
      return send(`u ${x} ${y} ${MOUSE_UP[ev.button ?? 0] ?? MOUSE_UP[0]}`);
    case 'wheel': {
      const d = Math.max(-1200, Math.min(1200, Math.round(-(Number(ev.deltaY) || 0))));
      return send(`w ${x} ${y} ${d}`);
    }
    case 'key': {
      const up = ev.keyAction === 'up';
      const code = (ev.code && SC[ev.code] && ev.code) || KEY_TO_CODE[ev.key || ''] || '';
      const sc = SC[code];
      if (sc) {
        const id = `${sc[0]}|${sc[1] ? 1 : 0}`;
        if (up) pressed.delete(id);
        else pressed.add(id);
        return send(`k ${sc[0]} ${sc[1] ? 1 : 0} ${up ? 1 : 0}`);
      }
      // Bilinmeyen fiziksel tuş: tek karakteri Unicode olarak yaz (yalnız basışta)
      if (!up && ev.key && [...ev.key].length === 1) {
        const cp = ev.key.codePointAt(0) || 0;
        if (cp > 0 && cp <= 0xffff) return send(`c ${cp}`);
      }
      return { ok: false, error: 'unknown_key' };
    }
    default:
      return { ok: false, error: 'unknown_type' };
  }
}

/** Takılı kalmasın: basılı tüm tuşları ve fare tuşlarını bırak */
function releaseAll() {
  if (mac) mac.releaseAllMac();
  if (process.platform !== 'win32' || !ps) return;
  for (const id of pressed) {
    const [sc, ext] = id.split('|');
    send(`k ${sc} ${ext} 1`);
  }
  pressed.clear();
}

/** Paylaşım kaynağı (main displayMedia handler'dan) */
function setShareSource(src) {
  shareSource = src && src.id ? { id: String(src.id), displayId: src.displayId ? String(src.displayId) : '' } : null;
  lastTargetLine = '';
}

/** Eski renderer API: pencerenin ekranını bulmak için ipucu */
function setRendererBounds(b) {
  rendererBounds = b;
  lastTargetLine = '';
}

function setEnabled(on) {
  enabled = Boolean(on);
  if (!enabled) releaseAll();
}

function disposeRemoteInput() {
  releaseAll();
  if (mac) mac.disposeMac();
  if (!ps) return;
  write('Q');
  try {
    ps.kill();
  } catch {
    /* ignore */
  }
  ps = null;
  ready = false;
}

module.exports = {
  injectRemoteInput,
  disposeRemoteInput,
  setShareSource,
  setRendererBounds,
  setEnabled,
  releaseAll,
  setUserOverrideListener,
  /** test: scripts/remote-input-smoke.js */
  _PS_BOOT: PS_BOOT,
};
