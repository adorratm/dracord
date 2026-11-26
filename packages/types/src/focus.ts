/** D6 — ortak odak (Pomodoro) zamanlayıcısı: durum başlangıç anından hesaplanır (sunucu zamanlayıcısı yok) */
export interface FocusSessionDto {
  channelId: string;
  /** ISO; null = kapalı */
  startedAt: string | null;
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  /** kaç odak turunda bir uzun mola */
  longEvery: number;
  startedBy: string | null;
}

export type FocusPhase = 'idle' | 'focus' | 'break' | 'long';

export interface FocusState {
  phase: FocusPhase;
  /** 1'den başlar */
  round: number;
  /** bu evrenin bitişi (ms epoch) */
  endsAt: number;
  /** bu evrenin uzunluğu (ms) */
  lengthMs: number;
}

/** Saf fonksiyon: oturum + şimdi → evre (tüm istemcilerde aynı sonuç) */
export function focusStateAt(s: Pick<FocusSessionDto, 'startedAt' | 'focusMin' | 'breakMin' | 'longBreakMin' | 'longEvery'>, now: number): FocusState {
  if (!s.startedAt) return { phase: 'idle', round: 0, endsAt: 0, lengthMs: 0 };
  const start = Date.parse(s.startedAt);
  const f = s.focusMin * 60_000;
  const b = s.breakMin * 60_000;
  const l = s.longBreakMin * 60_000;
  const every = Math.max(1, s.longEvery);
  const cycle = every * f + (every - 1) * b + l;
  let t = Math.max(0, now - start);
  const cycles = Math.floor(t / cycle);
  t -= cycles * cycle;
  let at = start + cycles * cycle;
  for (let i = 0; i < every; i++) {
    const round = cycles * every + i + 1;
    if (t < f) return { phase: 'focus', round, endsAt: at + f, lengthMs: f };
    t -= f;
    at += f;
    const brk = i === every - 1 ? l : b;
    if (t < brk) return { phase: i === every - 1 ? 'long' : 'break', round, endsAt: at + brk, lengthMs: brk };
    t -= brk;
    at += brk;
  }
  return { phase: 'focus', round: (cycles + 1) * every + 1, endsAt: at + f, lengthMs: f };
}
