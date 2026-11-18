'use client';

import { useEffect, useState } from 'react';
import { cn } from '../lib/cn';
import { bindingFromKey, bindingFromMouse, formatBinding, type KeyBinding } from '../lib/voice-input';

interface KeybindCaptureProps {
  label: string;
  description?: string;
  value: KeyBinding | null;
  onChange: (next: KeyBinding | null) => void;
  /** allow mouse side / middle buttons (push-to-talk: yes; toggle hotkeys: no) */
  allowMouse?: boolean;
  /** allow a lone modifier such as Left Ctrl (push-to-talk: yes) */
  allowLoneModifier?: boolean;
}

/** A settings row that records a key (or mouse side button) combination. Esc cancels. */
export function KeybindCapture({ label, description, value, onChange, allowMouse = false, allowLoneModifier = false }: KeybindCaptureProps) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const finish = (b: KeyBinding | null) => {
      setRecording(false);
      if (b) onChange(b);
    };
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') return finish(null);
      const b = bindingFromKey(e);
      if (!b) return;
      const lone = !b.ctrl && !b.alt && !b.shift && !b.meta && /^(Control|Shift|Alt|Meta)(Left|Right)$/.test(b.code);
      if (lone && !allowLoneModifier) return; // wait for the real key
      finish(b);
    };
    // a lone modifier as push-to-talk: take it on release, so Ctrl+V can still be pressed as a combination
    const onKeyUp = (e: KeyboardEvent) => {
      if (!allowLoneModifier) return;
      if (/^(Control|Shift|Alt|Meta)(Left|Right)$/.test(e.code)) {
        e.preventDefault();
        finish({ code: e.code });
      }
    };
    const onMouse = (e: MouseEvent) => {
      if (!allowMouse) return;
      const b = bindingFromMouse(e);
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      finish(b);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('mousedown', onMouse, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('mousedown', onMouse, true);
    };
  }, [recording, onChange, allowMouse, allowLoneModifier]);

  return (
    <div className="flex items-center justify-between gap-space-sm px-space-md py-space-md min-w-0">
      <div className="min-w-0 flex-1">
        <p className="font-body-md text-on-surface">{label}</p>
        {description && <p className="font-body-sm text-on-surface-variant mt-1">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setRecording((r) => !r)}
          aria-label={`${label}: ${recording ? 'tuşa bas' : formatBinding(value)}`}
          className={cn(
            'min-w-[8.5rem] rounded-lg px-3 py-1.5 font-label-md text-sm border transition-colors',
            recording
              ? 'border-primary bg-primary-container/20 text-primary animate-pulse'
              : 'border-outline-variant bg-surface-container text-on-surface hover:border-primary',
          )}
        >
          {recording ? (allowMouse ? 'Bir tuşa ya da fare tuşuna bas…' : 'Bir tuş birleşimine bas…') : formatBinding(value)}
        </button>
        {value && !recording ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`${label} kısayolunu kaldır`}
            className="rounded-lg px-2 py-1.5 text-sm text-on-surface-variant hover:text-error"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}

