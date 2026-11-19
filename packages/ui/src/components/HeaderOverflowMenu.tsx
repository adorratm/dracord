'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';

export interface HeaderOverflowItem {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
  /** small count next to the label (e.g. pinned messages) */
  badge?: number | null;
}

/**
 * "⋮" button that holds the less-used channel header actions on narrow screens
 * (search and members stay outside).
 */
export function HeaderOverflowMenu({ items, className }: { items: HeaderOverflowItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;
  return (
    <div ref={ref} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        aria-label="Diğer kanal araçları"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface',
          open && 'bg-surface-container text-on-surface',
        )}
      >
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-9 z-50 min-w-[12rem] rounded-xl border border-outline-variant/40 bg-surface-container-high shadow-float py-1">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left font-body-md text-on-surface hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{it.icon}</span>
              <span className="flex-1">{it.label}</span>
              {it.badge ? <span className="rounded-full bg-surface-container px-1.5 font-label-sm text-on-surface-variant">{it.badge}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
