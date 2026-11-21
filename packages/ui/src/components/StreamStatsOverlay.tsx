'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { summarizeStats, type StreamStats } from '../lib/stream-stats';

const KEY = 'dracord.stream-stats';
const LIM_TR: Record<string, string> = { bandwidth: 'bant genişliği', cpu: 'işlemci', other: 'diğer' };

function loadOn() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Yayın üzerinde istatistik katmanı (çözünürlük, fps, bit hızı, kayıp, codec) — teşhis için */
export function StreamStatsOverlay({
  getStatsReport,
  className,
}: {
  getStatsReport: () => Promise<RTCStatsReport | undefined> | undefined;
  className?: string;
}) {
  const [on, setOn] = useState(loadOn);
  const [s, setS] = useState<StreamStats | null>(null);
  const prev = useRef<{ bytes: number; ts: number } | null>(null);
  const getRef = useRef(getStatsReport);
  getRef.current = getStatsReport;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!on) return;
    let alive = true;
    prev.current = null;
    const tick = async () => {
      try {
        const rep = await getRef.current();
        if (!alive || !rep) return;
        const { stats, next } = summarizeStats(rep, prev.current);
        prev.current = next;
        setS(stats);
      } catch {
        /* parça kapandı */
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [on]);

  return (
    <div className={cn('pointer-events-auto flex flex-col items-end gap-1', className)}>
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        aria-label="Yayın istatistikleri"
        title="Yayın istatistikleri"
        className={cn('h-7 w-7 rounded-lg flex items-center justify-center text-white', on ? 'bg-primary-container/90' : 'bg-black/55 hover:bg-black/75')}
      >
        <span className="material-symbols-outlined text-[16px]">monitoring</span>
      </button>
      {on ? (
        <div className="rounded-lg bg-black/70 px-2 py-1.5 font-mono text-[11px] leading-4 text-white/90 tabular-nums" role="status" aria-live="off">
          {s ? (
            <>
              <div>
                {s.direction === 'in' ? '⬇' : '⬆'} {s.width && s.height ? `${s.width}×${s.height}` : '—'} · {s.fps ?? '—'} fps
              </div>
              <div>
                {s.kbps !== null ? (s.kbps >= 1000 ? `${(s.kbps / 1000).toFixed(1)} Mbps` : `${s.kbps} kbps`) : '—'} · {s.codec ?? '—'}
                {s.direction === 'out' && s.layers > 1 ? ` · ${s.layers} katman` : ''}
              </div>
              <div>
                kayıp {s.lossPct ?? '—'}% · rtt {s.rttMs ?? '—'} ms{s.jitterMs !== null ? ` · jitter ${s.jitterMs} ms` : ''}
              </div>
              {s.limitation ? <div className="text-amber-300">sınırlayan: {LIM_TR[s.limitation] ?? s.limitation}</div> : null}
            </>
          ) : (
            <div>ölçülüyor…</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
