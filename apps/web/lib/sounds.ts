/** Short UI beeps via Web Audio — no binary assets required. */
export type UiToneKind = 'join' | 'leave' | 'peer-join' | 'peer-leave';

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
  for (const { t, hz } of opts.freqs) {
    if (t === 0) osc.frequency.setValueAtTime(hz, now);
    else osc.frequency.setValueAtTime(hz, now + t);
  }
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(opts.peak, now + attack);
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
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume();

    if (kind === 'join') {
      // Yukarı çıkan iki not — odaya girdin
      playTone(ctx, {
        type: 'triangle',
        freqs: [
          { t: 0, hz: 660 },
          { t: 0.09, hz: 880 },
        ],
        peak: 0.11,
        duration: 0.22,
      });
    } else if (kind === 'peer-join') {
      // Kısa yükselen tık — biri geldi
      playTone(ctx, {
        type: 'sine',
        freqs: [
          { t: 0, hz: 560 },
          { t: 0.06, hz: 720 },
        ],
        peak: 0.07,
        duration: 0.14,
        attack: 0.01,
      });
    } else if (kind === 'leave') {
      // Belirgin alçalan üç not — sen çıktın
      playTone(ctx, {
        type: 'triangle',
        freqs: [
          { t: 0, hz: 520 },
          { t: 0.1, hz: 390 },
          { t: 0.2, hz: 260 },
        ],
        peak: 0.12,
        duration: 0.38,
        attack: 0.025,
      });
    } else {
      // peer-leave: yumuşak alçalan çift tık — biri çıktı (senden farklı)
      playTone(ctx, {
        type: 'sine',
        freqs: [
          { t: 0, hz: 480 },
          { t: 0.07, hz: 340 },
        ],
        peak: 0.065,
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
