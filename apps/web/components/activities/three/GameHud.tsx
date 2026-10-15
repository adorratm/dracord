'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@dracord/ui';
import {
  isElementFullscreen,
  toggleGameFullscreen,
} from '@/lib/game-fullscreen';

export type GameHudPlayer = {
  id: string;
  label: string;
  detail?: string;
  active?: boolean;
  highlight?: string;
  /** Oyuncu satırının altında ek içerik (örn. giren toplar) */
  extra?: ReactNode;
};

/** Ortak, responsive oyun HUD — 3D sahne üstü (320px+) */
export function GameHud({
  title,
  status,
  meta,
  error,
  players,
  actions,
  children,
  /** Tam ekran hedefi; verilmezse en yakın oyun kökü */
  fullscreenTargetRef,
  /** Blackjack / Bowling: false */
  lockLandscape = false,
  showFullscreenButton = true,
}: {
  title: string;
  status: string;
  meta?: ReactNode;
  error?: string | null;
  players?: GameHudPlayer[];
  actions?: ReactNode;
  children?: ReactNode;
  fullscreenTargetRef?: React.RefObject<HTMLElement | null>;
  lockLandscape?: boolean;
  showFullscreenButton?: boolean;
}) {
  const [playersOpen, setPlayersOpen] = useState(false);
  const [fs, setFs] = useState(false);
  const localRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFs = () => {
      const el =
        fullscreenTargetRef?.current ??
        localRootRef.current?.closest('[data-game-root]') ??
        localRootRef.current?.parentElement;
      setFs(isElementFullscreen(el as HTMLElement | null));
    };
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('dracord-rn-fs', onFs);
    onFs();
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('dracord-rn-fs', onFs);
    };
  }, [fullscreenTargetRef]);

  const onToggleFs = useCallback(() => {
    const el =
      fullscreenTargetRef?.current ??
      (localRootRef.current?.closest('[data-game-root]') as HTMLElement | null) ??
      localRootRef.current?.parentElement;
    void toggleGameFullscreen(el ?? null, { lockLandscape }).then(setFs);
  }, [fullscreenTargetRef, lockLandscape]);

  const playerCount = players?.length ?? 0;

  return (
    <>
      <div ref={localRootRef} className="contents" aria-hidden />
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-10 flex max-w-[100vw] flex-col gap-1.5 p-1.5 sm:gap-2 sm:p-3',
          'pt-[max(0.35rem,env(safe-area-inset-top))]',
          'overflow-x-hidden',
        )}
      >
        <div className="flex min-w-0 max-w-full flex-wrap items-start justify-between gap-1.5 sm:gap-2">
          <div className="flex min-w-0 max-w-full flex-1 flex-col gap-1 basis-[min(100%,12rem)]">
            <span className="inline-flex max-w-full items-center rounded-xl border border-[#bd93f9]/45 bg-[#11131e]/88 px-2 py-1 text-[10px] font-semibold text-[#f8f8f2] shadow-lg backdrop-blur-md sm:px-2.5 sm:py-1.5 sm:text-xs">
              <span className="truncate">
                {title}
                <span className="font-normal text-[#f8f8f2]/75"> · {status}</span>
              </span>
            </span>
            {meta ? (
              <div className="inline-flex max-w-full flex-wrap gap-1 text-[9px] text-[#bd93f9] sm:text-[11px]">
                {meta}
              </div>
            ) : null}
            {error ? (
              <span className="inline-flex max-w-full rounded-lg bg-[#ff5555]/20 px-2 py-1 text-[9px] text-[#ff5555] sm:text-[11px]">
                {error}
              </span>
            ) : null}
          </div>

          <div className="pointer-events-auto flex shrink-0 items-start gap-1">
            {showFullscreenButton ? (
              <button
                type="button"
                onClick={onToggleFs}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#bd93f9]/35 bg-[#11131e]/88 text-[#f8f8f2] shadow backdrop-blur-md sm:h-9 sm:w-9"
                aria-label={fs ? 'Tam ekrandan çık' : 'Tam ekran'}
                title={fs ? 'Tam ekrandan çık' : 'Tam ekran'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {fs ? 'fullscreen_exit' : 'fullscreen'}
                </span>
              </button>
            ) : null}

            {playerCount > 0 ? (
              <>
                <button
                  type="button"
                  className="flex h-8 items-center gap-1 rounded-lg border border-[#bd93f9]/35 bg-[#11131e]/88 px-2 text-[10px] font-semibold text-[#bd93f9] shadow backdrop-blur-md sm:hidden"
                  onClick={() => setPlayersOpen((v) => !v)}
                  aria-expanded={playersOpen}
                >
                  <span className="material-symbols-outlined text-[16px]">group</span>
                  {playerCount}
                </button>
                <div
                  className={cn(
                    'max-h-[36vh] w-[min(100vw-1rem,14rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-[#bd93f9]/30 bg-[#11131e]/92 p-2 text-[10px] text-[#f8f8f2] shadow-lg backdrop-blur-md sm:max-h-[40vh] sm:w-auto sm:min-w-[11rem] sm:max-w-[16rem] sm:text-[11px]',
                    // Dar ekranda drawer; sm+ her zaman görünür
                    playersOpen ? 'absolute right-1.5 top-10 z-20 sm:static' : 'hidden sm:block',
                  )}
                >
                  <p className="mb-1 font-semibold text-[#bd93f9]">Oyuncular</p>
                  <ul className="space-y-1.5">
                    {players!.map((p) => (
                      <li
                        key={p.id}
                        className={cn(
                          'rounded-md px-1 py-0.5',
                          p.active && 'bg-[#50fa7b]/12 text-[#50fa7b]',
                        )}
                      >
                        <div className="flex min-w-0 items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate font-medium">{p.label}</span>
                          <span className="shrink-0 tabular-nums text-[#f8f8f2]/75">
                            {p.highlight ?? p.detail ?? ''}
                          </span>
                        </div>
                        {p.extra ? <div className="mt-0.5 text-[#f8f8f2]">{p.extra}</div> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {actions ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 z-10 flex max-w-[100vw] justify-center overflow-x-hidden p-1.5 sm:p-3',
            'pb-[max(0.35rem,env(safe-area-inset-bottom))]',
          )}
        >
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-[#bd93f9]/25 bg-[#11131e]/90 px-1.5 py-1.5 shadow-xl backdrop-blur-md sm:gap-2.5 sm:px-3 sm:py-2">
            {actions}
          </div>
        </div>
      ) : null}

      {children}
    </>
  );
}

export function GameHudButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
}) {
  const styles =
    variant === 'success'
      ? 'bg-[#50fa7b] text-[#11131e]'
      : variant === 'danger'
        ? 'bg-[#ff5555]/90 text-[#f8f8f2]'
        : variant === 'secondary'
          ? 'bg-[#44307a] text-[#f8f8f2]'
          : 'bg-[#bd93f9] text-[#11131e]';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-h-9 rounded-xl px-2.5 text-[10px] font-semibold transition active:scale-[0.98] disabled:opacity-45 sm:h-10 sm:px-4 sm:text-[13px]',
        styles,
      )}
    >
      {children}
    </button>
  );
}
