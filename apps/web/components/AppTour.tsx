'use client';

import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  APP_TOUR_STEPS,
  appTourTargetSelector,
  hasCompletedAppTour,
  markAppTourCompleted,
} from '@dracord/types';
import { Draco } from '@/components/Draco';
import { useAuth } from '@/components/AuthProvider';

type Rect = { top: number; left: number; width: number; height: number };

function measure(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  const pad = 8;
  return {
    top: Math.max(0, r.top - pad),
    left: Math.max(0, r.left - pad),
    width: Math.min(window.innerWidth - (r.left - pad), r.width + pad * 2),
    height: Math.min(window.innerHeight - (r.top - pad), r.height + pad * 2),
  };
}

export function AppTour() {
  const { user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [hole, setHole] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!ready || !user) return;
    if (user.usernameConfirmed === false) return;
    if (hasCompletedAppTour(user.id)) return;
    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, [ready, user]);

  useEffect(() => {
    const onStart = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener('dracord:start-tour', onStart);
    return () => window.removeEventListener('dracord:start-tour', onStart);
  }, []);

  const current = APP_TOUR_STEPS[step]!;

  const refreshHole = useCallback(() => {
    if (!current.target) {
      setHole(null);
      return;
    }
    setHole(measure(appTourTargetSelector(current.target)));
  }, [current.target]);

  useLayoutEffect(() => {
    if (!open) return;
    refreshHole();
    const onResize = () => refreshHole();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, step, refreshHole]);

  const finish = useCallback(() => {
    markAppTourCompleted(user?.id);
    setOpen(false);
  }, [user?.id]);

  const next = () => {
    if (step >= APP_TOUR_STEPS.length - 1) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  };

  const back = () => {
    if (step <= 0) return;
    setStep((s) => s - 1);
  };

  if (!mounted || !open) return null;

  const cardStyle: CSSProperties = hole
    ? {
        position: 'fixed',
        zIndex: 10001,
        top: Math.min(hole.top + hole.height + 16, window.innerHeight - 260),
        left: Math.min(Math.max(16, hole.left), window.innerWidth - 360),
        width: 'min(22rem, calc(100vw - 2rem))',
      }
    : {
        position: 'fixed',
        zIndex: 10001,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(24rem, calc(100vw - 2rem))',
      };

  if (hole && hole.top + hole.height > window.innerHeight * 0.55) {
    cardStyle.top = Math.max(16, hole.top - 240);
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true" aria-label="Uygulama turu">
      <svg className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect
                x={hole.left}
                y={hole.top}
                width={hole.width}
                height={hole.height}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(10, 8, 18, 0.78)"
          mask="url(#tour-mask)"
        />
        {hole && (
          <rect
            x={hole.left}
            y={hole.top}
            width={hole.width}
            height={hole.height}
            rx={12}
            fill="none"
            stroke="#bd93f9"
            strokeWidth={2}
            className="animate-pulse"
          />
        )}
      </svg>

      <div
        style={cardStyle}
        className="rounded-2xl bg-[#282a36] border border-[#44475a] shadow-2xl p-5 flex flex-col gap-3"
      >
        <div className="flex items-start gap-3">
          <Draco size={64} mood={current.mood ?? 'happy'} glow />
          <div className="min-w-0 flex-1 pt-1">
            <p className="font-label-sm text-[#6272a4] mb-1">
              {step + 1} / {APP_TOUR_STEPS.length}
            </p>
            <h2 className="font-headline-md text-lg text-[#f8f8f2]">{current.title}</h2>
            <p className="font-body-sm text-sm text-[#9a95b0] mt-1 leading-relaxed">
              {current.body}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={finish}
            className="px-3 py-2 rounded-lg text-sm text-[#6272a4] hover:text-[#f8f8f2] transition-colors"
          >
            Atla
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="px-3 py-2 rounded-lg text-sm text-[#bd93f9] hover:bg-[#44475a]/40 transition-colors"
              >
                Geri
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="px-5 py-2.5 rounded-full font-bold text-sm text-[#1e1e2e] bg-gradient-to-r from-[#ff79c6] to-[#bd93f9] hover:opacity-95 active:scale-95 transition-all"
            >
              {step >= APP_TOUR_STEPS.length - 1 ? 'Tamamla' : 'İleri'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
