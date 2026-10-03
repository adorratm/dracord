'use client';

import { useEffect, useRef, useState } from 'react';
import type { SearchHit } from '@dracord/types';
import { platformSearch } from '@/lib/api';
import { getWebAppUrl } from '@/lib/site';

const WEB_URL = getWebAppUrl();

const DEFAULT_SEARCH_TYPES = ['messages', 'users', 'channels', 'guilds'] as const;

type Props = {
  placeholder?: string;
  types?: readonly string[];
  guildId?: string;
  className?: string;
};

export function AdminSearchBar({
  placeholder = 'Elasticsearch ile ara…',
  types = DEFAULT_SEARCH_TYPES,
  guildId,
  className,
}: Props) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const typesKey = types.join(',');

  useEffect(() => {
    if (q.trim().length < 1) {
      setHits((prev) => (prev.length === 0 ? prev : []));
      setError((prev) => (prev === null ? prev : null));
      return;
    }

    const resolvedTypes = typesKey.split(',').filter(Boolean);
    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void platformSearch({
        q,
        types: resolvedTypes,
        guildId,
        limit: 20,
      })
        .then((r) => {
          if (cancelled) return;
          setHits(r.hits);
          setOpen(true);
        })
        .catch((err) => {
          if (cancelled) return;
          setHits([]);
          setError(err instanceof Error ? err.message : 'Arama başarısız');
          setOpen(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, typesKey, guildId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative z-30 max-w-xl ${className ?? ''}`}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (hits.length || error || q.trim()) setOpen(true);
        }}
        placeholder={placeholder}
        className="h-9 w-full rounded border border-dracula-current bg-dracula-bg px-3 text-sm text-dracula-fg outline-none focus:border-dracula-purple"
      />
      {open && q.trim() ? (
        <div
          className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-dracula-current bg-dracula-bg-darker shadow-lg"
          onMouseDown={(e) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest?.('a')) return;
            e.preventDefault();
          }}
        >
          {loading ? (
            <p className="px-3 py-2 text-sm text-dracula-comment">Aranıyor…</p>
          ) : null}
          {error ? <p className="px-3 py-2 text-sm text-dracula-red">{error}</p> : null}
          {!loading && !error && hits.length === 0 ? (
            <p className="px-3 py-2 text-sm text-dracula-comment">Sonuç yok</p>
          ) : null}
          <ul>
            {hits.map((hit) => {
              if (hit.type === 'message') {
                const threadId = hit.threadRootId || undefined;
                const qs = new URLSearchParams();
                qs.set('around', threadId ?? hit.id);
                if (threadId) qs.set('thread', threadId);
                const href = hit.guildId
                  ? `${WEB_URL}/channels/${hit.guildId}/${hit.channelId}?${qs}`
                  : `${WEB_URL}/channels/@me/${hit.channelId}?${qs}`;
                return (
                  <li key={`m-${hit.id}`}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="block cursor-pointer px-3 py-2 text-sm hover:bg-dracula-current/40"
                      onClick={() => setOpen(false)}
                    >
                      <span className="text-xs text-dracula-purple">
                        mesaj{hit.threadRootId ? ' · thread' : ''}
                      </span>{' '}
                      <span className="text-dracula-fg">{hit.authorName}</span>
                      <p
                        className="line-clamp-2 text-dracula-comment"
                        dangerouslySetInnerHTML={{ __html: hit.snippet }}
                      />
                    </a>
                  </li>
                );
              }
              if (hit.type === 'guild') {
                return (
                  <li key={`g-${hit.id}`}>
                    <a
                      href={`/guilds/${hit.id}`}
                      className="block cursor-pointer px-3 py-2 text-sm hover:bg-dracula-current/40"
                    >
                      <span className="text-xs text-dracula-cyan">sunucu</span>{' '}
                      <span className="text-dracula-fg">{hit.name}</span>
                    </a>
                  </li>
                );
              }
              if (hit.type === 'channel') {
                return (
                  <li key={`c-${hit.id}`}>
                    <a
                      href={hit.guildId ? `/guilds/${hit.guildId}` : '/guilds'}
                      className="block cursor-pointer px-3 py-2 text-sm hover:bg-dracula-current/40"
                    >
                      <span className="text-xs text-dracula-green">kanal</span>{' '}
                      <span className="text-dracula-fg">{hit.name}</span>
                    </a>
                  </li>
                );
              }
              return (
                <li key={`u-${hit.id}`}>
                  <a
                    href={`/users/${hit.id}`}
                    className="block cursor-pointer px-3 py-2 text-sm hover:bg-dracula-current/40"
                  >
                    <span className="text-xs text-dracula-pink">kullanıcı</span>{' '}
                    <span className="text-dracula-fg">{hit.displayName}</span>
                    <span className="text-dracula-comment"> @{hit.username}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
