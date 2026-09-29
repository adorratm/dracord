'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Drawer hangi breakpoint ve üzerinde otomatik kapanır (inline panel orada görünür). */
export type MobileDrawerUntil = 'md' | 'lg' | 'xl';

const UNTIL_MQ: Record<MobileDrawerUntil, string> = {
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
};

export function MobileDrawer({
  open,
  onClose,
  side = 'left',
  children,
  title,
  until = 'md',
}: {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  children: ReactNode;
  title?: string;
  /** Bu breakpoint ve üzerinde drawer kapanır. Üye paneli için `lg`. */
  until?: MobileDrawerUntil;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(UNTIL_MQ[until]);
    const sync = () => {
      if (mq.matches && open) onClose();
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [until, open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" data-mobile-drawer="">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        className={`absolute top-0 bottom-0 z-[1] ${
          side === 'left' ? 'left-0' : 'right-0'
        } w-[min(100vw-3rem,20rem)] max-w-full bg-surface-container-low shadow-float flex flex-col`}
        role="dialog"
        aria-modal
        aria-label={title ?? 'Panel'}
      >
        <div className="h-12 px-space-sm flex items-center justify-between border-b border-surface-container-high shrink-0">
          <span className="font-headline-md text-on-surface truncate">{title ?? 'Panel'}</span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
            aria-label="Kapat"
          >
            <span className="material-symbols-outlined text-[20px] leading-none">close</span>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
