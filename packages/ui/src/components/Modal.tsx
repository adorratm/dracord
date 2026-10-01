'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ open, title, onClose, children, footer, className }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-0 sm:p-space-md">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 transition-opacity duration-200"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full sm:max-w-md max-h-[min(92dvh,40rem)] flex flex-col rounded-t-2xl sm:rounded-2xl bg-surface-container-low border border-surface-container-high shadow-float dracord-slide-up',
          className,
        )}
      >
        <div className="h-12 px-space-md flex items-center justify-between border-b border-surface-container-high shrink-0">
          <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface transition-colors duration-200"
            aria-label="Kapat"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="p-space-md overflow-y-auto min-h-0 flex-1">{children}</div>
        {footer && (
          <div className="px-space-md pb-space-md pt-space-xs flex justify-end gap-space-sm shrink-0 border-t border-surface-container-high/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
