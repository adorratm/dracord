'use client';

import type { SearchHit } from '@dracord/types';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '../lib/cn';

export interface QuickSwitcherProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  hits: SearchHit[];
  loading?: boolean;
  onSelect: (hit: SearchHit) => void;
}

export function QuickSwitcher({
  open,
  onClose,
  query,
  onQueryChange,
  hits,
  loading,
  onSelect,
}: QuickSwitcherProps) {
  const [active, setActive] = useState(0);
  const filtered = useMemo(
    () => hits.filter((h) => h.type === 'guild' || h.type === 'channel' || h.type === 'user'),
    [hits],
  );

  useEffect(() => {
    setActive(0);
  }, [query, filtered.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && filtered[active]) {
        e.preventDefault();
        onSelect(filtered[active]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, filtered, active, onSelect]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-surface-container-lowest shadow-bar overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-space-sm px-space-md border-b border-surface-container-high">
          <span className="material-symbols-outlined text-outline">search</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Sunucu, kanal veya kullanıcı ara…"
            className="flex-1 h-12 bg-transparent outline-none font-body-md text-on-surface"
          />
          <kbd className="font-label-sm text-outline">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-space-xs">
          {loading && (
            <li className="px-space-md py-space-sm font-body-sm text-outline">Aranıyor…</li>
          )}
          {!loading && query && filtered.length === 0 && (
            <li className="px-space-md py-space-sm font-body-sm text-outline">Sonuç yok</li>
          )}
          {filtered.map((hit, i) => (
            <li key={`${hit.type}-${hit.id}`}>
              <button
                type="button"
                className={cn(
                  'w-full flex items-center gap-space-sm px-space-md py-space-sm text-left hover:bg-surface-container-high',
                  i === active && 'bg-surface-container-high',
                )}
                onMouseEnter={() => setActive(i)}
                onClick={() => onSelect(hit)}
              >
                <span className="material-symbols-outlined text-[18px] text-outline">
                  {hit.type === 'guild' ? 'dns' : hit.type === 'channel' ? 'tag' : 'person'}
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="font-body-md text-on-surface truncate">
                    {hit.type === 'user'
                      ? hit.displayName
                      : hit.type === 'channel'
                        ? `#${hit.name}`
                        : hit.name}
                  </span>
                  <span className="font-label-sm text-outline">
                    {hit.type === 'guild'
                      ? 'Sunucu'
                      : hit.type === 'channel'
                        ? 'Kanal'
                        : `@${hit.username}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
