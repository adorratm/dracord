'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { AdminSearchBar } from '@/components/AdminSearchBar';
import { listAllGuilds, type PlatformAdminGuildDetail } from '@/lib/api';

const GUILD_SEARCH_TYPES = ['guilds', 'channels', 'messages'] as const;

export default function GuildsPage() {
  const [guilds, setGuilds] = useState<PlatformAdminGuildDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await listAllGuilds();
        if (!cancelled) setGuilds(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Liste alınamadı');
          setGuilds([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-dracula-fg">Sunucular</h2>
          <p className="text-sm text-dracula-comment">
            Platformdaki tüm sunucular — detay için seçin.
          </p>
        </div>
        <AdminSearchBar
          placeholder="Elasticsearch: sunucu / kanal / mesaj ara…"
          types={GUILD_SEARCH_TYPES}
        />
        {error ? <p className="text-sm text-dracula-red">{error}</p> : null}
        {loading ? (
          <p className="text-dracula-comment">Yükleniyor…</p>
        ) : (
          <ul className="divide-y divide-dracula-current rounded-lg border border-dracula-current">
            {guilds.length === 0 ? (
              <li className="px-4 py-6 text-center text-dracula-comment">Sunucu yok</li>
            ) : (
              guilds.map((g) => (
                <li key={g.id}>
                  <a
                    href={`/guilds/${g.id}`}
                    className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition hover:bg-dracula-current/40"
                  >
                    <div>
                      <p className="font-medium text-dracula-fg">{g.name}</p>
                      <p className="text-sm text-dracula-comment">
                        {g.memberCount} üye · {g.channelCount} kanal · sahip:{' '}
                        <code className="text-xs">{g.ownerId}</code>
                      </p>
                    </div>
                    <code className="shrink-0 text-xs text-dracula-cyan">{g.id}</code>
                  </a>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
