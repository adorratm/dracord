'use client';

import { useEffect, useRef, useState } from 'react';
import { focusStateAt, type FocusPhase, type FocusSessionDto } from '@dracord/types';

export type FocusClient = {
  connectSocket(): unknown;
  joinChannel(channelId: string): void;
  getFocus(channelId: string): Promise<FocusSessionDto>;
  startFocus(channelId: string, cfg: { focusMin?: number; breakMin?: number; longBreakMin?: number; longEvery?: number }): Promise<FocusSessionDto>;
  stopFocus(channelId: string): Promise<FocusSessionDto>;
  onFocusEvent(handler: (e: FocusSessionDto) => void): () => void;
};

const PRESETS = [
  { label: '25 / 5', focusMin: 25, breakMin: 5, longBreakMin: 15 },
  { label: '50 / 10', focusMin: 50, breakMin: 10, longBreakMin: 20 },
  { label: '90 / 15', focusMin: 90, breakMin: 15, longBreakMin: 30 },
] as const;

const PHASE: Record<FocusPhase, { label: string; color: string; hint: string }> = {
  idle: { label: 'Hazır', color: '#6272a4', hint: 'Birlikte odaklanmak için bir süre seç.' },
  focus: { label: 'Odak', color: '#ff79c6', hint: 'Bildirimleri sustur, işine dön.' },
  break: { label: 'Kısa mola', color: '#50fa7b', hint: 'Kalk, su iç, gözlerini dinlendir.' },
  long: { label: 'Uzun mola', color: '#8be9fd', hint: 'Güzel iş! Biraz uzun bir ara ver.' },
};

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** evre değişiminde yumuşak iki notalı zil (ses dosyası yok) */
function chime(up: boolean): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = up ? [523.25, 783.99] : [783.99, 523.25];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* ses yoksa sessiz geç */
  }
}

export interface FocusTimerProps {
  client: FocusClient;
  channelId: string;
  /** başlatanın adını göstermek için */
  nameOf?: (userId: string) => string | undefined;
  className?: string;
}

/** D6 — kanalın ortak odak (Pomodoro) zamanlayıcısı: kanaldaki herkes aynı sayacı görür */
export function FocusTimer({ client, channelId, nameOf, className }: FocusTimerProps) {
  const [session, setSession] = useState<FocusSessionDto | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);
  const prevPhase = useRef<FocusPhase | null>(null);

  useEffect(() => {
    let alive = true;
    client.connectSocket();
    client.joinChannel(channelId);
    client
      .getFocus(channelId)
      .then((s) => alive && setSession(s))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Zamanlayıcı yüklenemedi'));
    const off = client.onFocusEvent((s) => s.channelId === channelId && setSession(s));
    return () => {
      alive = false;
      off();
    };
  }, [client, channelId]);

  useEffect(() => {
    if (!session?.startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [session?.startedAt]);

  const st = session ? focusStateAt(session, now) : null;

  useEffect(() => {
    if (!st) return;
    const p = prevPhase.current;
    prevPhase.current = st.phase;
    if (p && p !== st.phase && st.phase !== 'idle' && sound) chime(st.phase === 'focus');
  }, [st?.phase, sound, st]);

  const run = async (fn: () => Promise<FocusSessionDto>) => {
    setBusy(true);
    setError(null);
    try {
      setSession(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  if (!session || !st) {
    return error ? <p className="font-body-sm text-error">{error}</p> : <div className="h-64 animate-pulse rounded-xl bg-surface-container-high" />;
  }

  const meta = PHASE[st.phase];
  const left = st.phase === 'idle' ? session.focusMin * 60_000 : st.endsAt - now;
  const pct = st.phase === 'idle' ? 0 : 1 - left / st.lengthMs;
  const R = 88;
  const C = 2 * Math.PI * R;
  const starter = session.startedBy ? nameOf?.(session.startedBy) : undefined;

  return (
    <div className={`flex flex-col items-center gap-space-md ${className ?? ''}`}>
      <div className="relative h-56 w-56" role="timer" aria-live="polite" aria-label={`${meta.label}, ${mmss(left)} kaldı`}>
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <circle cx="100" cy="100" r={R} fill="none" stroke="currentColor" strokeWidth="10" className="text-surface-container-highest" />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={meta.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-label-md uppercase tracking-widest" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <span className="font-mono text-5xl font-semibold tabular-nums text-on-surface">{mmss(left)}</span>
          {st.phase !== 'idle' && <span className="font-label-sm text-on-surface-variant">Tur {st.round}</span>}
        </div>
      </div>
      <p className="text-center font-body-sm text-on-surface-variant">
        {meta.hint}
        {st.phase !== 'idle' && starter ? <span className="block text-outline">{starter} başlattı</span> : null}
      </p>
      {st.phase === 'idle' ? (
        <div className="flex flex-wrap justify-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={busy}
              onClick={() => void run(() => client.startFocus(channelId, { focusMin: p.focusMin, breakMin: p.breakMin, longBreakMin: p.longBreakMin, longEvery: 4 }))}
              className="rounded-full bg-surface-container-high px-4 py-2 font-label-md text-on-surface hover:bg-primary hover:text-on-primary disabled:opacity-50"
            >
              ▶ {p.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => client.stopFocus(channelId))}
            className="rounded-full bg-surface-container-high px-4 py-2 font-label-md text-on-surface hover:bg-error/20 disabled:opacity-50"
          >
            ■ Bitir
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => client.startFocus(channelId, session))}
            className="rounded-full bg-surface-container-high px-4 py-2 font-label-md text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
          >
            ↺ Baştan
          </button>
        </div>
      )}
      <label className="flex items-center gap-2 font-label-sm text-on-surface-variant">
        <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
        Evre değişince zil çal
      </label>
      {error && <p className="font-body-sm text-error">{error}</p>}
      <p className="text-center font-label-sm text-outline">
        Kanaldaki herkes aynı sayacı görür · {session.focusMin} dk odak, {session.breakMin} dk mola, her {session.longEvery} turda {session.longBreakMin} dk
      </p>
    </div>
  );
}
