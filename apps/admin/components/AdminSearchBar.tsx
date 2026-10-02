'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SearchHit } from '@dracord/types';
import { platformSearch } from '@/lib/api';

const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

type Props = {
  placeholder?: string;
  types?: string[];
  guildId?: string;
  className?: string;
};

export function AdminSearchBar({
  placeholder = 'Elasticsearch ile ara…',
  types = ['messages', 'users', 'channels', 'guilds'],
  guildId,
  className,
}: Props) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 1) {
      setHits([]);
      setError(null);
      return;
    }
    const t = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void platformSearch({
        q,
        types,
        guildId,
        limit: 20,
      })
        .then((r) => {
          setHits(r.hits);
          setOpen(true);
        })
        .catch((err) => {
          setHits([]);
          setError(err instanceof Error ? err.message : 'Arama başarısız');
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [q, types, guildId]);

  return (
    <div className={`relative ${className ?? ''}`}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (hits.length || error) setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 180);
        }}
        placeholder={placeholder}
        className="h-9 w-full max-w-xl rounded border border-dracula-current bg-dracula-bg px-3 text-sm text-dracula-fg outline-none focus:border-dracula-purple"
      />
      {open && q.trim() ? (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-80 overflow-y-auto rounded-lg border border-dracula-current bg-dracula-bg-darker shadow-lg">
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
                      className="block px-3 py-2 text-sm hover:bg-dracula-current/40"
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
                    <Link
                      href={`/guilds/${hit.id}`}
                      className="block px-3 py-2 text-sm hover:bg-dracula-current/40"
                    >
                      <span className="text-xs text-dracula-cyan">sunucu</span>{' '}
                      <span className="text-dracula-fg">{hit.name}</span>
                    </Link>
                  </li>
                );
              }
              if (hit.type === 'channel') {
                return (
                  <li key={`c-${hit.id}`}>
                    <Link
                      href={hit.guildId ? `/guilds/${hit.guildId}` : '/guilds'}
                      className="block px-3 py-2 text-sm hover:bg-dracula-current/40"
                    >
                      <span className="text-xs text-dracula-green">kanal</span>{' '}
                      <span className="text-dracula-fg">{hit.name}</span>
                    </Link>
                  </li>
                );
              }
              return (
                <li key={`u-${hit.id}`}>
                  <Link
                    href={`/users/${hit.id}`}
                    className="block px-3 py-2 text-sm hover:bg-dracula-current/40"
                  >
                    <span className="text-xs text-dracula-pink">kullanıcı</span>{' '}
                    <span className="text-dracula-fg">{hit.displayName}</span>
                    <span className="text-dracula-comment"> @{hit.username}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
