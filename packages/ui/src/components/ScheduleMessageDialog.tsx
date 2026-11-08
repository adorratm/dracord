'use client';

import { useEffect, useMemo, useState } from 'react';
import { SCHEDULED_MESSAGE_LIMITS, type ScheduledMessageDto } from '@dracord/types';
import { cn } from '../lib/cn';
import { formatScheduleTime } from '../lib/use-scheduled-messages';
import { Modal } from './Modal';

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function presets(now: Date): Array<{ label: string; at: Date }> {
  const inMin = (m: number) => new Date(now.getTime() + m * 60_000);
  const tomorrow9 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  const tonight21 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0);
  const out = [
    { label: '30 dk sonra', at: inMin(30) },
    { label: '1 saat sonra', at: inMin(60) },
    { label: '3 saat sonra', at: inMin(180) },
  ];
  if (tonight21.getTime() - now.getTime() > 60 * 60_000) out.push({ label: 'Bu akşam 21:00', at: tonight21 });
  out.push({ label: 'Yarın 09:00', at: tomorrow9 });
  return out;
}

/** Mesajı ileri bir zamana planla */
export function ScheduleMessageDialog({
  open,
  text,
  onClose,
  onConfirm,
}: {
  open: boolean;
  text: string;
  onClose: () => void;
  onConfirm: (sendAt: Date) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useMemo(() => new Date(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValue(toLocalInput(new Date(Date.now() + 60 * 60_000)));
  }, [open]);

  const min = toLocalInput(new Date(now.getTime() + SCHEDULED_MESSAGE_LIMITS.minDelayMs));
  const max = toLocalInput(new Date(now.getTime() + SCHEDULED_MESSAGE_LIMITS.maxDelayMs));

  const submit = async (at: Date) => {
    if (!Number.isFinite(at.getTime())) return setError('Geçerli bir zaman seç');
    if (at.getTime() < Date.now() + SCHEDULED_MESSAGE_LIMITS.minDelayMs - 5_000) {
      return setError('En az 1 dakika sonrası seçilmeli');
    }
    setBusy(true);
    setError(null);
    const res = await onConfirm(at);
    setBusy(false);
    if (res.ok) onClose();
    else setError(res.error);
  };

  return (
    <Modal
      open={open}
      title="Mesajı zamanla"
      onClose={busy ? () => undefined : onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-9 px-4 rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={busy || !value}
            onClick={() => void submit(new Date(value))}
            className="h-9 px-4 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-60"
          >
            {busy ? 'Zamanlanıyor…' : 'Zamanla'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="font-body-sm text-on-surface-variant line-clamp-3 whitespace-pre-wrap rounded-lg bg-surface-container px-3 py-2">
          {text || '—'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {presets(now).map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={busy}
              onClick={() => void submit(p.at)}
              className="h-8 px-3 rounded-full bg-surface-container-high hover:bg-surface-container-highest font-label-sm text-on-surface"
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-on-surface-variant">Özel zaman</span>
          <input
            type="datetime-local"
            value={value}
            min={min}
            max={max}
            onChange={(e) => setValue(e.target.value)}
            className="h-10 rounded-lg bg-surface-container-highest px-3 font-body-md text-on-surface outline-none [color-scheme:dark]"
          />
        </label>
        {value && Number.isFinite(new Date(value).getTime()) && (
          <p className="font-label-sm text-outline">{formatScheduleTime(new Date(value))} gönderilecek</p>
        )}
        {error && (
          <p className="font-body-sm text-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Kanaldaki bekleyen zamanlanmış mesajlarım (ChatInput üstünde) */
export function ScheduledMessagesBar({
  items,
  onCancel,
  onSendNow,
  className,
}: {
  items: ScheduledMessageDto[];
  onCancel: (id: string) => void;
  onSendNow: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className={cn('mx-space-sm mb-1 rounded-lg bg-surface-container-low border border-surface-container-highest', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-8 px-3 flex items-center gap-2 font-label-sm text-on-surface-variant hover:text-on-surface"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          schedule_send
        </span>
        <span className="flex-1 text-left truncate">
          {items.length} zamanlanmış mesaj · ilki {formatScheduleTime(items[0]!.sendAt)}
        </span>
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          {open ? 'expand_more' : 'expand_less'}
        </span>
      </button>
      {open && (
        <ul className="max-h-48 overflow-y-auto px-2 pb-2 flex flex-col gap-1">
          {items.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-md bg-surface-container px-2 py-1.5">
              <span className="font-label-sm text-primary-container shrink-0 tabular-nums">
                {formatScheduleTime(m.sendAt)}
              </span>
              <span className="font-body-sm text-on-surface truncate flex-1" title={m.content}>
                {m.content || (m.attachments.length ? `${m.attachments.length} ek` : '—')}
              </span>
              <button
                type="button"
                onClick={() => onSendNow(m.id)}
                className="h-7 px-2 rounded-md font-label-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface shrink-0"
                title="Şimdi gönder"
              >
                Şimdi
              </button>
              <button
                type="button"
                onClick={() => onCancel(m.id)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-outline hover:text-error hover:bg-surface-container-high shrink-0"
                aria-label="Zamanlanmış mesajı iptal et"
                title="İptal"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
