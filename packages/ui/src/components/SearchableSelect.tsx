'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  /** Tam genişlik (mobil / form satırları) */
  fullWidth?: boolean;
  emptyLabel?: string;
  id?: string;
  'aria-label'?: string;
}

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Seç…',
  searchPlaceholder = 'Ara…',
  disabled,
  className,
  fullWidth,
  emptyLabel = 'Sonuç yok',
  id,
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description?.toLowerCase().includes(q) ?? false) ||
        o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const pick = useCallback(
    (opt: SearchableSelectOption) => {
      if (opt.disabled) return;
      onChange(opt.value);
      setOpen(false);
    },
    [onChange],
  );

  const onListKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative min-w-0',
        fullWidth ? 'w-full' : 'w-full sm:w-auto sm:min-w-[11rem]',
        className,
      )}
    >
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-xl border border-outline-variant/40',
          'bg-surface-container-highest px-3 text-left font-body-sm text-on-surface',
          'outline-none transition-colors',
          'hover:border-outline/60 focus-visible:ring-2 focus-visible:ring-primary/40',
          disabled && 'cursor-not-allowed opacity-50',
          open && 'border-primary/50 ring-2 ring-primary/30',
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-outline')}>
          {selected?.label ?? placeholder}
        </span>
        <span
          className={cn(
            'material-symbols-outlined shrink-0 text-[18px] text-outline transition-transform',
            open && 'rotate-180',
          )}
        >
          expand_more
        </span>
      </button>

      {open ? (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-outline-variant/40',
            'bg-surface-container-lowest shadow-lg',
            'max-h-[min(16rem,50vh)] flex flex-col',
          )}
        >
          <div className="flex items-center gap-2 border-b border-outline-variant/30 px-3 py-2">
            <span className="material-symbols-outlined text-[18px] text-outline">search</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onListKeyDown}
              placeholder={searchPlaceholder}
              className="h-8 w-full min-w-0 bg-transparent font-body-sm text-on-surface outline-none placeholder:text-outline"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            className="flex-1 overflow-y-auto overscroll-contain py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 font-body-sm text-outline">{emptyLabel}</li>
            ) : (
              filtered.map((opt, idx) => (
                <li key={opt.value} role="option" aria-selected={opt.value === value}>
                  <button
                    type="button"
                    disabled={opt.disabled}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => pick(opt)}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left font-body-sm',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                      idx === highlight
                        ? 'bg-primary-container/40 text-on-surface'
                        : 'text-on-surface hover:bg-surface-container-high',
                      opt.value === value && 'font-medium',
                    )}
                  >
                    <span className="truncate w-full">{opt.label}</span>
                    {opt.description ? (
                      <span className="truncate w-full font-label-sm text-outline">
                        {opt.description}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Ayar satırı düzeni — SettingsSelect yerine */
export function SearchableSelectField({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}): ReactNode {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-space-sm sm:gap-space-md px-space-md py-space-md min-w-0">
      <div className="min-w-0 flex-1">
        <p className="font-body-md text-on-surface">{label}</p>
        {description ? (
          <p className="font-body-sm text-on-surface-variant mt-1">{description}</p>
        ) : null}
      </div>
      <SearchableSelect
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
        className="sm:max-w-[16rem]"
      />
    </div>
  );
}
