'use client';

import type { ReactNode } from 'react';
import { cn } from '@dracord/ui';

export type GameHudPlayer = {
  id: string;
  label: string;
  detail?: string;
  active?: boolean;
  highlight?: string;
  /** Oyuncu satırının altında ek içerik (örn. giren toplar) */
  extra?: ReactNode;
};

/** Ortak, responsive oyun HUD — 3D sahne üstü */
export function GameHud({
  title,
  status,
  meta,
  error,
  players,
  actions,
  children,
}: {
  title: string;
  status: string;
  meta?: ReactNode;
  error?: string | null;
  players?: GameHudPlayer[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-2 sm:p-3',
          'pt-[max(0.5rem,env(safe-area-inset-top))]',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 max-w-full flex-col gap-1">
            <span className="inline-flex max-w-full items-center rounded-xl border border-[#bd93f9]/45 bg-[#11131e]/88 px-2.5 py-1.5 text-[11px] font-semibold text-[#f8f8f2] shadow-lg backdrop-blur-md sm:text-xs">
              <span className="truncate">
                {title}
                <span className="font-normal text-[#f8f8f2]/75"> · {status}</span>
              </span>
            </span>
            {meta ? (
              <div className="inline-flex max-w-full flex-wrap gap-1 text-[10px] text-[#bd93f9] sm:text-[11px]">
                {meta}
              </div>
            ) : null}
            {error ? (
              <span className="inline-flex max-w-full rounded-lg bg-[#ff5555]/20 px-2.5 py-1 text-[10px] text-[#ff5555] sm:text-[11px]">
                {error}
              </span>
            ) : null}
          </div>

          {players && players.length > 0 ? (
            <div className="pointer-events-none max-h-[40vh] min-w-[9.5rem] max-w-[min(100%,16rem)] overflow-y-auto rounded-xl border border-[#bd93f9]/30 bg-[#11131e]/88 p-2 text-[10px] text-[#f8f8f2] shadow-lg backdrop-blur-md sm:min-w-[12rem] sm:text-[11px]">
              <p className="mb-1 font-semibold text-[#bd93f9]">Oyuncular</p>
              <ul className="space-y-1.5">
                {players.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      'rounded-md px-1 py-0.5',
                      p.active && 'bg-[#50fa7b]/12 text-[#50fa7b]',
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
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
          ) : null}
        </div>
      </div>

      {actions ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-2 sm:p-3',
            'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
          )}
        >
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#bd93f9]/25 bg-[#11131e]/90 px-2 py-2 shadow-xl backdrop-blur-md sm:gap-2.5 sm:px-3">
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
        'h-9 rounded-xl px-3.5 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-45 sm:h-10 sm:px-4 sm:text-[13px]',
        styles,
      )}
    >
      {children}
    </button>
  );
}
