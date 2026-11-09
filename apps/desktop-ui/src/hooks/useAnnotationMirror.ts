import { useEffect, useRef } from 'react';
import { strokeAlpha, type ScreenAnnotationController } from '@dracord/ui';

/**
 * A4 — kendi ekranını paylaşırken gelen çizimleri gerçek ekranında göster
 * (şeffaf, tıklanamaz, yakalamaya girmeyen pencere; yalnız ekran paylaşımı).
 */
export function useAnnotationMirror(ctl: ScreenAnnotationController, active: boolean) {
  const api = typeof window !== 'undefined' ? window.dracordDesktop : undefined;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const shown = useRef(false);

  useEffect(() => {
    if (!api?.renderAnnotations) return;
    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      if (shown.current) void api.hideAnnotations?.();
      shown.current = false;
    };
    if (!active) {
      stop();
      return;
    }
    const tick = () => {
      const t = Date.now();
      const out: Array<{ c: number; a: number; n: string; p: number[] }> = [];
      for (const s of ctl.strokesRef.current.values()) {
        const a = strokeAlpha(s, t);
        if (a <= 0 || !s.points.length) continue;
        out.push({ c: s.color, a, n: s.endedAt === null ? (s.userName ?? '') : '', p: s.points.flat() });
      }
      if (out.length) {
        shown.current = true;
        void api.renderAnnotations?.(out);
      } else {
        stop();
      }
    };
    tick();
    if (!timer.current && ctl.strokesRef.current.size) timer.current = setInterval(tick, 50);
  }, [api, active, ctl.version, ctl.strokesRef]);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      void api?.hideAnnotations?.();
    },
    [api],
  );
}
