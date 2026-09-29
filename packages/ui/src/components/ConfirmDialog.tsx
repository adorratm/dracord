'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-space-md">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Kapat"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md rounded-2xl bg-surface-container-low border border-surface-container-high shadow-float dracord-fade-in"
      >
        <div className="p-space-lg space-y-space-md">
          <div className="flex items-start gap-space-md">
            <span
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                danger ? 'bg-error-container text-on-error-container' : 'bg-surface-container-highest text-on-surface',
              )}
            >
              <span className="material-symbols-outlined text-[22px]">
                {danger ? 'warning' : 'help'}
              </span>
            </span>
            <div className="min-w-0">
              <h2 id="confirm-title" className="font-headline-md text-headline-md text-on-surface">
                {title}
              </h2>
              {description && (
                <div className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">
                  {description}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-space-sm pt-space-sm">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="h-10 px-space-md rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors duration-200"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className={cn(
                'h-10 px-space-md rounded-lg font-headline-md transition-colors duration-200 disabled:opacity-50',
                danger
                  ? 'bg-error text-on-error hover:bg-error-container'
                  : 'bg-primary-container text-on-primary-container hover:bg-primary',
              )}
            >
              {busy ? 'İşleniyor…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
