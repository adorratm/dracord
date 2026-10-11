/** Web Audio FX for activity games — unlock after first user gesture. */

let ctx: AudioContext | null = null;
let muted = false;

export function setGameAudioMuted(next: boolean) {
  muted = next;
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockGameAudio() {
  ensureCtx();
}

function beep(
  freq: number,
  durationMs: number,
  type: OscillatorType = 'sine',
  gain = 0.06,
) {
  if (muted) return;
  const ac = ensureCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(ac.destination);
  const t = ac.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + durationMs / 1000);
  osc.start(t);
  osc.stop(t + durationMs / 1000);
}

export const GameAudio = {
  unlock: unlockGameAudio,
  setMuted: setGameAudioMuted,
  collide: () => beep(180, 80, 'triangle', 0.05),
  pot: () => {
    beep(420, 120, 'sine', 0.07);
    window.setTimeout(() => beep(620, 100, 'sine', 0.05), 60);
  },
  cushion: () => beep(140, 50, 'square', 0.03),
  shoot: () => beep(90, 70, 'sawtooth', 0.04),
};
