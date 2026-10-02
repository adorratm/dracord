'use client';

import type { SearchHit, SearchHitMessage } from '@dracord/types';
import { useEffect } from 'react';
import { cn } from '../lib/cn';

export type SearchScope = 'everywhere' | 'guild' | 'channel' | 'dms';

export interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  scope: SearchScope;
  onScopeChange: (s: SearchScope) => void;
  hits: SearchHit[];
  loading?: boolean;
  onSelectMessage: (hit: SearchHitMessage) => void;
  guildName?: string;
  channelName?: string;
}

export function SearchPanel({
  open,
  onClose,
  query,
  onQueryChange,
  scope,
  onScopeChange,
  hits,
  loading,
  onSelectMessage,
  guildName,
  channelName,
}: SearchPanelProps) {
  const messages = hits.filter((h): h is SearchHitMessage => h.type === 'message');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const scopes: { id: SearchScope; label: string }[] = [
    { id: 'everywhere', label: 'Her yer' },
    { id: 'guild', label: guildName ? `Sunucu: ${guildName}` : 'Bu sunucu' },
    { id: 'channel', label: channelName ? `#${channelName}` : 'Bu kanal' },
    { id: 'dms', label: 'DM’ler' },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[10vh] bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-surface-container-lowest shadow-bar overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-space-sm px-space-md border-b border-surface-container-high">
          <span className="material-symbols-outlined text-outline">manage_search</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Mesajlarda ara…"
            className="flex-1 h-12 bg-transparent outline-none font-body-md text-on-surface"
          />
        </div>
        <div className="flex gap-space-xs px-space-md py-space-sm border-b border-surface-container-high overflow-x-auto">
          {scopes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onScopeChange(s.id)}
              className={cn(
                'h-8 px-space-sm rounded-lg font-label-sm whitespace-nowrap',
                scope === s.id
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-surface-container-high text-on-surface-variant',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ul className="flex-1 overflow-y-auto py-space-xs">
          {loading && (
            <li className="px-space-md py-space-sm font-body-sm text-outline">Aranıyor…</li>
          )}
          {!loading && query && messages.length === 0 && (
            <li className="px-space-md py-space-sm font-body-sm text-outline">Mesaj bulunamadı</li>
          )}
          {messages.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="w-full text-left px-space-md py-space-sm hover:bg-surface-container-high"
                onClick={() => onSelectMessage(hit)}
              >
                <div className="flex items-baseline justify-between gap-space-sm">
                  <span className="font-label-md text-on-surface">
                    {hit.authorName}
                    {hit.threadRootId ? (
                      <span className="ml-2 font-label-sm text-primary">Thread</span>
                    ) : null}
                  </span>
                  <time className="font-label-sm text-outline">
                    {new Date(hit.createdAt).toLocaleString('tr-TR')}
                  </time>
                </div>
                <p
                  className="font-body-sm text-on-surface-variant line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: hit.snippet }}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
