'use client';

import { useEffect, useRef, useState } from 'react';
import { VOICE_CHANNEL_STATUS_MAX } from '@dracord/types';
import { cn } from '../lib/cn';

/**
 * Ses kanalı durum metni — başlıkta göster/düzenle.
 * canEdit: kullanıcı kanalda ise. Enter kaydet · Esc vazgeç · boş = temizle.
 */
export function VoiceChannelStatusChip({
  status,
  canEdit,
  onSave,
  className,
}: {
  status?: string | null;
  canEdit?: boolean;
  onSave?: (status: string | null) => Promise<{ ok: boolean; error?: string } | void> | void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(status ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(status ?? '');
  }, [status, editing]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!status && !canEdit) return null;

  const commit = async (value: string | null) => {
    if (!onSave) return setEditing(false);
    setBusy(true);
    setError(null);
    try {
      const res = await onSave(value && value.trim() ? value : null);
      if (res && res.ok === false) {
        setError(res.error ?? 'error');
        return;
      }
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <form
        className={cn('flex items-center gap-1 min-w-0', className)}
        onSubmit={(e) => {
          e.preventDefault();
          void commit(draft);
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          maxLength={VOICE_CHANNEL_STATUS_MAX}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setEditing(false);
            }
          }}
          placeholder="Ne yapıyorsunuz? (ör. Valorant ranked)"
          aria-label="Ses kanalı durumu"
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-7 min-w-0 w-48 sm:w-64 rounded-md bg-surface-container-highest px-2 font-body-sm text-on-surface outline-none border',
            error ? 'border-error' : 'border-transparent focus:border-primary-container/60',
          )}
        />
        <button
          type="submit"
          disabled={busy}
          className="h-7 px-2 rounded-md bg-primary-container text-on-primary-container font-label-sm disabled:opacity-60"
        >
          Kaydet
        </button>
        {status && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void commit(null)}
            className="h-7 px-2 rounded-md text-on-surface-variant hover:bg-surface-container font-label-sm"
          >
            Temizle
          </button>
        )}
        {error && (
          <span className="font-label-sm text-error truncate max-w-[12rem]" role="alert">
            {error}
          </span>
        )}
      </form>
    );
  }

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => canEdit && setEditing(true)}
      title={canEdit ? 'Ses kanalı durumunu düzenle' : status ?? undefined}
      className={cn(
        'inline-flex items-center gap-1 min-w-0 max-w-[16rem] h-7 px-2 rounded-md font-label-sm transition-colors',
        status ? 'text-on-surface-variant' : 'text-outline',
        canEdit && 'hover:bg-surface-container hover:text-on-surface',
        className,
      )}
    >
      <span className="material-symbols-outlined text-[16px] shrink-0" aria-hidden>
        {status ? 'notes' : 'edit'}
      </span>
      <span className="truncate">{status || 'Durum ekle'}</span>
    </button>
  );
}
