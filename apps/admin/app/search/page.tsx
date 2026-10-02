'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SearchHit } from '@dracord/types';
import { AdminShell } from '@/components/AdminShell';
import { platformSearch } from '@/lib/api';

const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export default function AdminSearchPage() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [types, setTypes] = useState('messages,guilds,channels,users');

  useEffect(() => {
    if (q.trim().length < 1) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void platformSearch({
        q,
        types: types.split(',').map((s) => s.trim()).filter(Boolean),
        limit: 40,
      })
        .then((r) => setHits(r.hits))
        .catch((err) => {
          setHits([]);
          setError(err instanceof Error ? err.message : 'Arama başarısız');
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [q, types]);

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-dracula-fg">Elasticsearch arama</h2>
          <p className="mt-1 text-sm text-dracula-comment">
            Tüm sunucu, kanal, kullanıcı ve mesajlar (thread dahil).
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara…"
            className="h-10 flex-1 rounded-lg border border-dracula-current bg-dracula-bg px-3 text-sm text-dracula-fg outline-none focus:border-dracula-purple"
          />
          <select
            value={types}
            onChange={(e) => setTypes(e.target.value)}
            className="h-10 rounded-lg border border-dracula-current bg-dracula-bg px-3 text-sm text-dracula-fg"
          >
            <option value="messages,guilds,channels,users">Tümü</option>
            <option value="messages">Mesajlar / thread</option>
            <option value="guilds">Sunucular</option>
            <option value="channels">Kanallar</option>
            <option value="users">Kullanıcılar</option>
          </select>
        </div>

        {error ? <p className="text-sm text-dracula-red">{error}</p> : null}
        {loading ? <p className="text-sm text-dracula-comment">Aranıyor…</p> : null}

        <ul className="divide-y divide-dracula-current rounded-lg border border-dracula-current">
          {!loading && q && hits.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-dracula-comment">Sonuç yok</li>
          ) : null}
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
                <li key={`m-${hit.id}`} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="rounded bg-dracula-purple/20 px-1.5 py-0.5 text-xs text-dracula-purple">
                      mesaj{hit.threadRootId ? ' · thread' : ''}
                    </span>
                    <span className="font-medium text-dracula-fg">{hit.authorName}</span>
                    <time className="text-xs text-dracula-comment">
                      {new Date(hit.createdAt).toLocaleString('tr-TR')}
                    </time>
                    {hit.guildId ? (
                      <Link
                        href={`/guilds/${hit.guildId}`}
                        className="text-xs text-dracula-cyan hover:underline"
                      >
                        Sunucu
                      </Link>
                    ) : null}
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-dracula-green hover:underline"
                    >
                      Web’de aç
                    </a>
                  </div>
                  <p
                    className="mt-1 text-dracula-comment line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: hit.snippet }}
                  />
                </li>
              );
            }
            if (hit.type === 'guild') {
              return (
                <li key={`g-${hit.id}`} className="px-4 py-3 text-sm">
                  <span className="rounded bg-dracula-cyan/20 px-1.5 py-0.5 text-xs text-dracula-cyan">
                    sunucu
                  </span>{' '}
                  <Link href={`/guilds/${hit.id}`} className="font-medium text-dracula-fg hover:underline">
                    {hit.name}
                  </Link>
                </li>
              );
            }
            if (hit.type === 'channel') {
              return (
                <li key={`c-${hit.id}`} className="px-4 py-3 text-sm">
                  <span className="rounded bg-dracula-green/20 px-1.5 py-0.5 text-xs text-dracula-green">
                    kanal
                  </span>{' '}
                  <span className="font-medium text-dracula-fg">{hit.name}</span>
                  <span className="ml-2 text-xs text-dracula-comment">{hit.channelType}</span>
                  {hit.guildId ? (
                    <Link
                      href={`/guilds/${hit.guildId}`}
                      className="ml-2 text-xs text-dracula-cyan hover:underline"
                    >
                      Sunucu
                    </Link>
                  ) : null}
                </li>
              );
            }
            return (
              <li key={`u-${hit.id}`} className="px-4 py-3 text-sm">
                <span className="rounded bg-dracula-pink/20 px-1.5 py-0.5 text-xs text-dracula-pink">
                  kullanıcı
                </span>{' '}
                <span className="font-medium text-dracula-fg">{hit.displayName}</span>
                <span className="ml-2 text-dracula-comment">@{hit.username}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </AdminShell>
  );
}
