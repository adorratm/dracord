/** Web Audio FX for activity games — unlock after first user gesture. */

import { setDealerVoiceMuted, setDealerVoiceVolume } from './dealer-voice';

const STORAGE_MUTE = 'dracord.gameAudio.muted';
const STORAGE_VOL = 'dracord.gameAudio.volume';

let ctx: AudioContext | null = null;
let muted = false;
let volume = 0.85;

function loadPrefs() {
  if (typeof window === 'undefined') return;
  try {
    const m = localStorage.getItem(STORAGE_MUTE);
    if (m === '1' || m === 'true') muted = true;
    if (m === '0' || m === 'false') muted = false;
    const v = Number(localStorage.getItem(STORAGE_VOL));
    if (Number.isFinite(v)) volume = Math.min(1, Math.max(0, v));
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') loadPrefs();

export function isGameAudioMuted() {
  return muted;
}

export function getGameAudioVolume() {
  return volume;
}

export function setGameAudioMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(STORAGE_MUTE, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  // Oyun FX + kurpiyer TTS birlikte
  setDealerVoiceMuted(next);
}

/** 0–1 — oyun efektleri + kurpiyer */
export function setGameAudioVolume(next: number) {
  volume = Math.min(1, Math.max(0, next));
  try {
    localStorage.setItem(STORAGE_VOL, String(volume));
  } catch {
    /* ignore */
  }
  setDealerVoiceVolume(volume);
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Kullanıcı jesti içinde çağır — AudioContext'i running yapar */
export function unlockGameAudio() {
  const ac = ensureCtx();
  if (!ac) return;
  if (ac.state === 'suspended' || ac.state === 'interrupted') {
    void ac.resume().catch(() => undefined);
  }
}

function gainOf(base: number) {
  return Math.max(0.0001, base * volume);
}

/** Suspended bağlamda sessiz kalmasın — resume sonrası çal */
function withAudio(play: (ac: AudioContext) => void) {
  if (muted || volume <= 0.001) return;
  const ac = ensureCtx();
  if (!ac) return;
  if (ac.state === 'running') {
    play(ac);
    return;
  }
  void ac.resume().then(() => {
    if (ac.state === 'running' && !muted && volume > 0.001) play(ac);
  });
}

function beep(
  freq: number,
  durationMs: number,
  type: OscillatorType = 'sine',
  gain = 0.06,
) {
  withAudio((ac) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    const level = gainOf(gain);
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = level;
    osc.connect(g);
    g.connect(ac.destination);
    const t = ac.currentTime;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + durationMs / 1000);
    osc.start(t);
    osc.stop(t + durationMs / 1000);
  });
}

function noiseBurst(durationMs: number, gain = 0.04) {
  withAudio((ac) => {
    const n = Math.floor((ac.sampleRate * durationMs) / 1000);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource();
    const g = ac.createGain();
    const level = gainOf(gain);
    src.buffer = buf;
    g.gain.value = level;
    src.connect(g);
    g.connect(ac.destination);
    src.start();
  });
}

export const GameAudio = {
  unlock: unlockGameAudio,
  setMuted: setGameAudioMuted,
  setVolume: setGameAudioVolume,
  isMuted: isGameAudioMuted,
  getVolume: getGameAudioVolume,
  /** Bilardo — biraz daha yüksek gain (masa gürültüsü duyulsun) */
  collide: () => {
    beep(220, 70, 'triangle', 0.09);
    noiseBurst(40, 0.04);
  },
  pot: () => {
    beep(380, 100, 'sine', 0.1);
    window.setTimeout(() => beep(560, 110, 'sine', 0.08), 55);
    window.setTimeout(() => beep(720, 90, 'triangle', 0.05), 120);
  },
  cushion: () => {
    beep(160, 55, 'square', 0.055);
    noiseBurst(30, 0.025);
  },
  shoot: () => {
    beep(95, 85, 'sawtooth', 0.08);
    noiseBurst(50, 0.035);
  },
  /** Bowling */
  bowl: () => {
    noiseBurst(180, 0.035);
    beep(70, 160, 'sawtooth', 0.03);
  },
  pin: () => {
    beep(520, 45, 'triangle', 0.05);
    window.setTimeout(() => beep(380, 60, 'triangle', 0.035), 40);
  },
  gutter: () => beep(90, 200, 'sine', 0.04),
  strike: () => {
    beep(300, 80, 'square', 0.05);
    window.setTimeout(() => beep(480, 100, 'sine', 0.06), 70);
    window.setTimeout(() => beep(640, 140, 'sine', 0.05), 140);
  },
  /** Okey */
  tile: () => beep(640, 40, 'triangle', 0.035),
  discard: () => beep(280, 70, 'sine', 0.045),
  deal: () => {
    for (let i = 0; i < 4; i++) {
      window.setTimeout(() => beep(500 + i * 40, 35, 'triangle', 0.03), i * 45);
    }
  },
  win: () => {
    beep(440, 100, 'sine', 0.06);
    window.setTimeout(() => beep(554, 100, 'sine', 0.06), 90);
    window.setTimeout(() => beep(659, 160, 'sine', 0.07), 180);
  },
  /** Tavla */
  dice: () => {
    noiseBurst(90, 0.045);
    beep(200, 50, 'square', 0.03);
  },
  checker: () => beep(360, 55, 'triangle', 0.04),
  hit: () => {
    beep(160, 70, 'sawtooth', 0.05);
    window.setTimeout(() => beep(120, 90, 'sine', 0.04), 50);
  },
  /** Blackjack */
  cardFlip: () => {
    noiseBurst(35, 0.028);
    beep(720, 40, 'triangle', 0.028);
  },
  chip: () => {
    beep(880, 35, 'sine', 0.035);
    window.setTimeout(() => beep(1100, 40, 'sine', 0.03), 40);
  },
  bust: () => {
    beep(180, 120, 'sawtooth', 0.05);
    window.setTimeout(() => beep(120, 160, 'triangle', 0.04), 80);
  },
  blackjack: () => {
    beep(523, 90, 'sine', 0.06);
    window.setTimeout(() => beep(659, 90, 'sine', 0.06), 90);
    window.setTimeout(() => beep(784, 140, 'sine', 0.07), 180);
    window.setTimeout(() => beep(1046, 180, 'sine', 0.05), 280);
  },
  lose: () => {
    beep(300, 100, 'triangle', 0.04);
    window.setTimeout(() => beep(220, 140, 'sine', 0.035), 100);
  },
  push: () => {
    beep(400, 80, 'sine', 0.04);
    window.setTimeout(() => beep(400, 100, 'sine', 0.03), 120);
  },
};
