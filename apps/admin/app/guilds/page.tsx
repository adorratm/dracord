'use client';

import { useEffect, useState } from 'react';
import type { GuildSummary } from '@dracord/types';
import { AdminShell } from '@/components/AdminShell';
import { listGuilds } from '@/lib/api';

export default function GuildsPage() {
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await listGuilds();
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
          <p className="text-sm text-dracula-comment">Oturumunuzla erişilebilen sunucular.</p>
        </div>
        {error ? <p className="text-sm text-dracula-red">{error}</p> : null}
        {loading ? (
          <p className="text-dracula-comment">Yükleniyor…</p>
        ) : (
          <ul className="divide-y divide-dracula-current rounded-lg border border-dracula-current">
            {guilds.length === 0 ? (
              <li className="px-4 py-6 text-center text-dracula-comment">Sunucu yok</li>
            ) : (
              guilds.map((g) => (
                <li key={g.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-dracula-fg">{g.name}</p>
                    <p className="text-sm text-dracula-comment">Sahip: {g.ownerId}</p>
                  </div>
                  <code className="text-xs text-dracula-cyan">{g.id}</code>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
