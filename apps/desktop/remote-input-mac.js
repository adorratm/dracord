/**
 * macOS uzak kontrol — kalıcı `osascript -l JavaScript` (JXA) + CoreGraphics CGEvent.
 * Ek native modül yok. Erişilebilirlik izni gerekir (Sistem Ayarları → Gizlilik → Erişilebilirlik → Dracord).
 * Koordinatlar: global ekran noktaları (Electron DIP ile aynı uzay) → DPI dönüşümü gerekmez.
 * Kısıt: yalnız EKRAN paylaşımı (pencere paylaşımında hedef pencere sınırları alınamıyor).
 */
const { spawn } = require('child_process');

/** KeyboardEvent.code → macOS sanal tuş kodu (fiziksel konum, layout bağımsız) */
const KC = {
  KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyH: 4, KeyG: 5, KeyZ: 6, KeyX: 7, KeyC: 8, KeyV: 9,
  IntlBackslash: 10, KeyB: 11, KeyQ: 12, KeyW: 13, KeyE: 14, KeyR: 15, KeyY: 16, KeyT: 17,
  Digit1: 18, Digit2: 19, Digit3: 20, Digit4: 21, Digit6: 22, Digit5: 23, Equal: 24, Digit9: 25,
  Digit7: 26, Minus: 27, Digit8: 28, Digit0: 29, BracketRight: 30, KeyO: 31, KeyU: 32,
  BracketLeft: 33, KeyI: 34, KeyP: 35, Enter: 36, KeyL: 37, KeyJ: 38, Quote: 39, KeyK: 40,
  Semicolon: 41, Backslash: 42, Comma: 43, Slash: 44, KeyN: 45, KeyM: 46, Period: 47, Tab: 48,
  Space: 49, Backquote: 50, Backspace: 51, Escape: 53, MetaRight: 54, MetaLeft: 55, ShiftLeft: 56,
  CapsLock: 57, AltLeft: 58, ControlLeft: 59, ShiftRight: 60, AltRight: 61, ControlRight: 62,
  NumpadDecimal: 65, NumpadMultiply: 67, NumpadAdd: 69, NumLock: 71, NumpadDivide: 75,
  NumpadEnter: 76, NumpadSubtract: 78, Numpad0: 82, Numpad1: 83, Numpad2: 84, Numpad3: 85,
  Numpad4: 86, Numpad5: 87, Numpad6: 88, Numpad7: 89, Numpad8: 91, Numpad9: 92,
  F5: 96, F6: 97, F7: 98, F3: 99, F8: 100, F9: 101, F11: 103, F10: 109, F12: 111,
  Home: 115, PageUp: 116, Delete: 117, F4: 118, End: 119, F2: 120, PageDown: 121, F1: 122,
  ArrowLeft: 123, ArrowRight: 124, ArrowDown: 125, ArrowUp: 126,
};
const KEY_TO_CODE = {
  Escape: 'Escape', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab', ' ': 'Space',
  ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
  Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  Shift: 'ShiftLeft', Control: 'ControlLeft', Alt: 'AltLeft', Meta: 'MetaLeft',
};
/** Modifier tuş → CGEventFlags biti */
const MOD_FLAG = {
  56: 0x20000, 60: 0x20000, // shift
  59: 0x40000, 62: 0x40000, // control
  58: 0x80000, 61: 0x80000, // option
  55: 0x100000, 54: 0x100000, // command
};

const JXA = String.raw`
ObjC.import('Cocoa');
ObjC.import('CoreGraphics');
var stdin = $.NSFileHandle.fileHandleWithStandardInput;
var buf = '';
var flags = 0, held = {0:false,1:false,2:false};
var lastDown = { t: 0, x: 0, y: 0, b: -1, n: 1 };
var MD = {0:1, 1:25, 2:3}, MU = {0:2, 1:26, 2:4}, DRAG = {0:6, 1:27, 2:7};
function mouse(type, x, y, b, clicks) {
  var e = $.CGEventCreateMouseEvent($(), type, $.CGPointMake(x, y), b === 2 ? 1 : b === 1 ? 2 : 0);
  if (clicks) $.CGEventSetIntegerValueField(e, 1, clicks);
  if (flags) $.CGEventSetFlags(e, flags);
  $.CGEventPost(0, e);
}
function handle(l) {
  var p = l.split(' ');
  var x = +p[1], y = +p[2];
  switch (p[0]) {
    case 'm':
      var dragB = held[0] ? 0 : held[2] ? 2 : held[1] ? 1 : -1;
      mouse(dragB >= 0 ? DRAG[dragB] : 5, x, y, Math.max(0, dragB), 0);
      break;
    case 'd':
      var b = +p[3], now = Date.now();
      var n = (b === lastDown.b && now - lastDown.t < 400 && Math.abs(x - lastDown.x) < 6 && Math.abs(y - lastDown.y) < 6) ? lastDown.n + 1 : 1;
      lastDown = { t: now, x: x, y: y, b: b, n: n };
      held[b] = true;
      mouse(MD[b], x, y, b, n);
      break;
    case 'u':
      var bu = +p[3];
      held[bu] = false;
      mouse(MU[bu], x, y, bu, lastDown.b === bu ? lastDown.n : 1);
      break;
    case 'w':
      var e = $.CGEventCreateScrollWheelEvent2($(), 0, 1, +p[3], 0, 0);
      $.CGEventPost(0, e);
      break;
    case 'k':
      var kc = +p[1], up = p[2] === '1', f = +p[3] || 0;
      if (f) flags = up ? (flags & ~f) : (flags | f);
      var ke = $.CGEventCreateKeyboardEvent($(), kc, !up);
      $.CGEventSetFlags(ke, flags);
      $.CGEventPost(0, ke);
      break;
  }
}
console.log('READY');
while (true) {
  var d = stdin.availableData;
  if (!d || d.length === 0) break;
  buf += $.NSString.alloc.initWithDataEncoding(d, $.NSUTF8StringEncoding).js;
  var lines = buf.split('\n');
  buf = lines.pop();
  for (var i = 0; i < lines.length; i++) {
    if (lines[i] === 'Q') { $.exit(0); }
    try { handle(lines[i]); } catch (err) {}
  }
}
`;

/** @type {import('child_process').ChildProcessWithoutNullStreams | null} */
let proc = null;
let ready = false;
const queue = [];
const pressed = new Set();

function ensure() {
  if (proc && !proc.killed) return true;
  ready = false;
  proc = spawn('osascript', ['-l', 'JavaScript', '-e', JXA], { stdio: ['pipe', 'pipe', 'pipe'] });
  // JXA console.log → stderr
  const onOut = (buf) => {
    if (!ready && String(buf).includes('READY')) {
      ready = true;
      while (queue.length) write(queue.shift());
    }
  };
  proc.stdout.on('data', onOut);
  proc.stderr.on('data', onOut);
  proc.on('exit', () => {
    proc = null;
    ready = false;
  });
  return true;
}

function write(line) {
  try {
    proc?.stdin.write(line + '\n');
    return true;
  } catch {
    return false;
  }
}

function send(line) {
  ensure();
  if (!ready) {
    queue.push(line);
    if (queue.length > 120) queue.shift();
    return { ok: true, queued: true };
  }
  return write(line) ? { ok: true } : { ok: false, error: 'write_failed' };
}

let trustWarned = false;
function trusted(systemPreferences) {
  try {
    if (systemPreferences.isTrustedAccessibilityClient(false)) return true;
    if (!trustWarned) {
      trustWarned = true;
      systemPreferences.isTrustedAccessibilityClient(true); // izin penceresini bir kez aç
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * @param {{type:string,nx?:number,ny?:number,button?:number,deltaY?:number,key?:string,code?:string,keyAction?:string}} ev
 * @param {{x:number,y:number,width:number,height:number}} rect  paylaşılan ekran (DIP = global nokta)
 * @param {Electron.SystemPreferences} systemPreferences
 */
function injectMac(ev, rect, systemPreferences) {
  if (!trusted(systemPreferences)) return { ok: false, error: 'mac_accessibility_required' };
  const nx = Math.min(1, Math.max(0, Number(ev.nx) || 0));
  const ny = Math.min(1, Math.max(0, Number(ev.ny) || 0));
  const x = Math.round(rect.x + nx * (rect.width - 1));
  const y = Math.round(rect.y + ny * (rect.height - 1));
  const b = ev.button === 1 || ev.button === 2 ? ev.button : 0;
  switch (ev.type) {
    case 'move':
      return send(`m ${x} ${y}`);
    case 'down':
      return send(`d ${x} ${y} ${b}`);
    case 'up':
      return send(`u ${x} ${y} ${b}`);
    case 'wheel': {
      const d = Math.max(-1200, Math.min(1200, Math.round(-(Number(ev.deltaY) || 0))));
      return send(`w ${x} ${y} ${d}`);
    }
    case 'key': {
      const up = ev.keyAction === 'up';
      const code = (ev.code && KC[ev.code] !== undefined && ev.code) || KEY_TO_CODE[ev.key || ''] || '';
      const kc = KC[code];
      if (kc === undefined) return { ok: false, error: 'unknown_key' };
      if (up) pressed.delete(kc);
      else pressed.add(kc);
      return send(`k ${kc} ${up ? 1 : 0} ${MOD_FLAG[kc] || 0}`);
    }
    default:
      return { ok: false, error: 'unknown_type' };
  }
}

function releaseAllMac() {
  if (!proc) return;
  for (const kc of pressed) send(`k ${kc} 1 ${MOD_FLAG[kc] || 0}`);
  pressed.clear();
}

function disposeMac() {
  releaseAllMac();
  if (!proc) return;
  write('Q');
  try {
    proc.kill();
  } catch {
    /* ignore */
  }
  proc = null;
  ready = false;
}

module.exports = { injectMac, releaseAllMac, disposeMac, _JXA: JXA };
