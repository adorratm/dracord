/** Short UI beeps via Web Audio — no binary assets required. */
export type UiToneKind = 'join' | 'leave' | 'peer-join' | 'peer-leave';

let uiToneEnabled = true;
let uiToneVolume = 0.85;

/** Ayarlar / prefs yüklendiğinde çağır */
export function configureUiTones(opts: { enabled?: boolean; volume?: number }) {
  if (typeof opts.enabled === 'boolean') uiToneEnabled = opts.enabled;
  if (typeof opts.volume === 'number' && Number.isFinite(opts.volume)) {
    uiToneVolume = Math.max(0, Math.min(1, opts.volume));
  }
}

function playTone(
  ctx: AudioContext,
  opts: {
    type?: OscillatorType;
    freqs: Array<{ t: number; hz: number }>;
    peak: number;
    duration: number;
    attack?: number;
  },
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  const attack = opts.attack ?? 0.02;
  const peak = Math.max(0.0001, opts.peak * uiToneVolume);
  for (const { t, hz } of opts.freqs) {
    if (t === 0) osc.frequency.setValueAtTime(hz, now);
    else osc.frequency.setValueAtTime(hz, now + t);
  }
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
  osc.start(now);
  osc.stop(now + opts.duration + 0.02);
  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      // ignore
    }
  };
}

export function playUiTone(kind: UiToneKind) {
  if (typeof window === 'undefined') return;
  if (!uiToneEnabled || uiToneVolume <= 0) return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume();

    if (kind === 'join') {
      // Yukarı çıkan iki not — odaya girdin (peak yükseltilmiş)
      playTone(ctx, {
        type: 'triangle',
        freqs: [
          { t: 0, hz: 660 },
          { t: 0.09, hz: 880 },
        ],
        peak: 0.28,
        duration: 0.22,
      });
    } else if (kind === 'peer-join') {
      playTone(ctx, {
        type: 'sine',
        freqs: [
          { t: 0, hz: 560 },
          { t: 0.06, hz: 720 },
        ],
        peak: 0.2,
        duration: 0.14,
        attack: 0.01,
      });
    } else if (kind === 'leave') {
      playTone(ctx, {
        type: 'triangle',
        freqs: [
          { t: 0, hz: 520 },
          { t: 0.1, hz: 390 },
          { t: 0.2, hz: 260 },
        ],
        peak: 0.3,
        duration: 0.38,
        attack: 0.025,
      });
    } else {
      playTone(ctx, {
        type: 'sine',
        freqs: [
          { t: 0, hz: 480 },
          { t: 0.07, hz: 340 },
        ],
        peak: 0.18,
        duration: 0.18,
        attack: 0.012,
      });
    }

    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 500);
  } catch {
    // ignore autoplay / unsupported
  }
}
