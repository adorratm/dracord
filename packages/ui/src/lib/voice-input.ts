/**
 * A8 — voice input mode (voice activity / push-to-talk) and voice hotkeys.
 *
 * DOM-free: shared by web, desktop and mobile. A key binding is stored by physical key
 * (`KeyboardEvent.code`, layout independent: the same key on a Turkish-Q or an English
 * keyboard) or a mouse button (3 = back / Mouse4, 4 = forward / Mouse5, 1 = middle),
 * with modifiers.
 */

export interface KeyBinding {
  /** KeyboardEvent.code (e.g. "KeyV", "Backquote", "F13") — empty for a mouse button */
  code: string;
  /** MouseEvent.button for a mouse binding (1 middle, 3 back, 4 forward) */
  mouse?: number;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export type VoiceInputMode = 'voice' | 'ptt';

export interface VoiceInputSettings {
  mode: VoiceInputMode;
  pttKey: KeyBinding | null;
  /** keep transmitting this long after the key is released (ms) — the end of a word is not cut */
  pttReleaseMs: number;
  /** toggle mute / deafen from anywhere (desktop: also while a game has focus) */
  muteKey: KeyBinding | null;
  deafenKey: KeyBinding | null;
  /** soft click when push-to-talk opens / closes */
  pttSounds: boolean;
}

export const VOICE_INPUT_STORAGE_KEY = 'dracord.voice-input.v1';
export const VOICE_INPUT_EVENT = 'dracord:voice-input';

export const DEFAULT_VOICE_INPUT: VoiceInputSettings = {
  mode: 'voice',
  pttKey: null,
  pttReleaseMs: 200,
  muteKey: { code: 'KeyM', ctrl: true, shift: true },
  deafenKey: { code: 'KeyD', ctrl: true, shift: true },
  pttSounds: true,
};

const MODIFIER_CODES = new Set(['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

function normBinding(raw: unknown): KeyBinding | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const code = typeof r.code === 'string' ? r.code.slice(0, 32) : '';
  const mouse = typeof r.mouse === 'number' && [1, 3, 4].includes(r.mouse) ? r.mouse : undefined;
  if (!code && mouse === undefined) return null;
  return { code, ...(mouse !== undefined ? { mouse } : {}), ctrl: !!r.ctrl, alt: !!r.alt, shift: !!r.shift, meta: !!r.meta };
}

export function normalizeVoiceInput(raw: unknown): VoiceInputSettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const ms = Number(r.pttReleaseMs);
  return {
    mode: r.mode === 'ptt' ? 'ptt' : 'voice',
    pttKey: 'pttKey' in r ? normBinding(r.pttKey) : DEFAULT_VOICE_INPUT.pttKey,
    pttReleaseMs: Number.isFinite(ms) ? Math.max(0, Math.min(1500, Math.round(ms))) : DEFAULT_VOICE_INPUT.pttReleaseMs,
    muteKey: 'muteKey' in r ? normBinding(r.muteKey) : DEFAULT_VOICE_INPUT.muteKey,
    deafenKey: 'deafenKey' in r ? normBinding(r.deafenKey) : DEFAULT_VOICE_INPUT.deafenKey,
    pttSounds: r.pttSounds === undefined ? true : !!r.pttSounds,
  };
}

/** a key press as a binding (null while only a modifier is down — keep waiting) */
export function bindingFromKey(e: { code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): KeyBinding | null {
  if (!e.code || e.code === 'Escape') return null;
  // a lone modifier is a valid push-to-talk key (many use Left Ctrl / Alt) — but only when it is the only key
  if (MODIFIER_CODES.has(e.code)) return { code: e.code };
  return { code: e.code, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
}

export function bindingFromMouse(e: { button: number; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): KeyBinding | null {
  if (![1, 3, 4].includes(e.button)) return null; // left / right click are not hotkeys
  return { code: '', mouse: e.button, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
}

/** does this key / mouse event press the binding? (modifiers must match exactly, except for a lone-modifier binding) */
export function matchesBinding(
  b: KeyBinding | null,
  e: { code?: string; button?: number; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
): boolean {
  if (!b) return false;
  if (b.mouse !== undefined) {
    if (e.button !== b.mouse) return false;
  } else if (e.code !== b.code) return false;
  if (MODIFIER_CODES.has(b.code)) return true;
  return !!b.ctrl === e.ctrlKey && !!b.alt === e.altKey && !!b.shift === e.shiftKey && !!b.meta === e.metaKey;
}

/** is this the key that, when released, ends a push-to-talk hold? (modifiers no longer matter) */
export function releasesBinding(b: KeyBinding | null, e: { code?: string; button?: number }): boolean {
  if (!b) return false;
  return b.mouse !== undefined ? e.button === b.mouse : e.code === b.code;
}

const CODE_LABELS: Record<string, string> = {
  Backquote: '"',
  Space: 'Boşluk',
  CapsLock: 'Caps Lock',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Geri',
  ControlLeft: 'Sol Ctrl',
  ControlRight: 'Sağ Ctrl',
  ShiftLeft: 'Sol Shift',
  ShiftRight: 'Sağ Shift',
  AltLeft: 'Sol Alt',
  AltRight: 'Alt Gr',
  MetaLeft: 'Sol Win',
  MetaRight: 'Sağ Win',
  Minus: '*',
  Equal: '-',
  BracketLeft: 'Ğ',
  BracketRight: 'Ü',
  Semicolon: 'Ş',
  Quote: 'İ',
  Backslash: ',',
  Comma: 'Ö',
  Period: 'Ç',
  Slash: '.',
  IntlBackslash: '<',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Insert: 'Insert',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Pause: 'Pause',
  ScrollLock: 'Scroll Lock',
};

export function codeLabel(code: string): string {
  if (CODE_LABELS[code]) return CODE_LABELS[code]!;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** "Ctrl + Shift + M", "Fare 4", "Sol Ctrl" */
export function formatBinding(b: KeyBinding | null): string {
  if (!b) return 'Atanmadı';
  const parts: string[] = [];
  if (b.ctrl) parts.push('Ctrl');
  if (b.alt) parts.push('Alt');
  if (b.shift) parts.push('Shift');
  if (b.meta) parts.push('Win');
  parts.push(b.mouse !== undefined ? (b.mouse === 1 ? 'Fare orta' : `Fare ${b.mouse + 1}`) : codeLabel(b.code));
  return parts.join(' + ');
}

const ACCEL_KEYS: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Pause: 'Pause',
  ScrollLock: 'Scrolllock',
  CapsLock: 'Capslock',
};

/** Electron accelerator for a toggle hotkey (null: a mouse button or a lone modifier cannot be one) */
export function toElectronAccelerator(b: KeyBinding | null): string | null {
  if (!b || b.mouse !== undefined || MODIFIER_CODES.has(b.code)) return null;
  let key: string | null = null;
  if (/^Key[A-Z]$/.test(b.code)) key = b.code.slice(3);
  else if (/^Digit\d$/.test(b.code)) key = b.code.slice(5);
  else if (/^F([1-9]|1\d|2[0-4])$/.test(b.code)) key = b.code;
  else if (/^Numpad\d$/.test(b.code)) key = `num${b.code.slice(6)}`;
  else key = ACCEL_KEYS[b.code] ?? null;
  if (!key) return null;
  const mods: string[] = [];
  if (b.ctrl) mods.push('CommandOrControl');
  if (b.alt) mods.push('Alt');
  if (b.shift) mods.push('Shift');
  if (b.meta) mods.push('Super');
  return [...mods, key].join('+');
}

const VK: Record<string, number> = {
  Backquote: 0xc0,
  Minus: 0xbd,
  Equal: 0xbb,
  BracketLeft: 0xdb,
  BracketRight: 0xdd,
  Backslash: 0xdc,
  Semicolon: 0xba,
  Quote: 0xde,
  Comma: 0xbc,
  Period: 0xbe,
  Slash: 0xbf,
  IntlBackslash: 0xe2,
  Space: 0x20,
  Tab: 0x09,
  Enter: 0x0d,
  Backspace: 0x08,
  CapsLock: 0x14,
  Insert: 0x2d,
  Delete: 0x2e,
  Home: 0x24,
  End: 0x23,
  PageUp: 0x21,
  PageDown: 0x22,
  ArrowLeft: 0x25,
  ArrowUp: 0x26,
  ArrowRight: 0x27,
  ArrowDown: 0x28,
  Pause: 0x13,
  ScrollLock: 0x91,
  ShiftLeft: 0xa0,
  ShiftRight: 0xa1,
  ControlLeft: 0xa2,
  ControlRight: 0xa3,
  AltLeft: 0xa4,
  AltRight: 0xa5,
  MetaLeft: 0x5b,
  MetaRight: 0x5c,
  NumpadMultiply: 0x6a,
  NumpadAdd: 0x6b,
  NumpadSubtract: 0x6d,
  NumpadDecimal: 0x6e,
  NumpadDivide: 0x6f,
};

/**
 * Windows virtual-key codes that must all be held for the binding (for a global key-state
 * watcher). Null when the key has no known code.
 */
export function toWindowsVks(b: KeyBinding | null): number[] | null {
  if (!b) return null;
  let main: number | null = null;
  if (b.mouse !== undefined) main = b.mouse === 1 ? 0x04 : b.mouse === 3 ? 0x05 : 0x06;
  else if (/^Key[A-Z]$/.test(b.code)) main = b.code.charCodeAt(3);
  else if (/^Digit\d$/.test(b.code)) main = 0x30 + Number(b.code.slice(5));
  else if (/^Numpad\d$/.test(b.code)) main = 0x60 + Number(b.code.slice(6));
  else if (/^F([1-9]|1\d|2[0-4])$/.test(b.code)) main = 0x6f + Number(b.code.slice(1));
  else main = VK[b.code] ?? null;
  if (main === null) return null;
  const out = [main];
  if (!MODIFIER_CODES.has(b.code)) {
    if (b.ctrl) out.push(0x11);
    if (b.alt) out.push(0x12);
    if (b.shift) out.push(0x10);
    if (b.meta) out.push(0x5b);
  }
  return out;
}

/**
 * Whether the microphone should be sending right now.
 * Voice activity: unless muted. Push-to-talk: only while the key is held (and not muted).
 */
export function shouldTransmit(s: Pick<VoiceInputSettings, 'mode'>, state: { muted: boolean; pttHeld: boolean }): boolean {
  if (state.muted) return false;
  return s.mode === 'voice' ? true : state.pttHeld;
}

/** localStorage helpers (web / desktop; mobile passes its own storage) */
export function loadVoiceInput(storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): VoiceInputSettings {
  try {
    const raw = storage?.getItem(VOICE_INPUT_STORAGE_KEY);
    return raw ? normalizeVoiceInput(JSON.parse(raw)) : { ...DEFAULT_VOICE_INPUT };
  } catch {
    return { ...DEFAULT_VOICE_INPUT };
  }
}

export function saveVoiceInput(next: VoiceInputSettings, storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): void {
  try {
    storage?.setItem(VOICE_INPUT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / full */
  }
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(VOICE_INPUT_EVENT, { detail: next }));
  } catch {
    /* not a browser */
  }
}
