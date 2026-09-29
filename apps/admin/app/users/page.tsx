'use client';

import { useEffect, useState } from 'react';
import type { PublicUser } from '@dracord/types';
import { AdminShell } from '@/components/AdminShell';
import { searchUsers } from '@/lib/api';

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await searchUsers(query);
        if (!cancelled) setUsers(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Liste alınamadı');
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const t = setTimeout(() => void load(), 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-dracula-fg">Kullanıcılar</h2>
          <p className="text-sm text-dracula-comment">API üzerinden kullanıcı araması.</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kullanıcı adı veya görünen ad…"
          className="w-full max-w-md rounded border border-dracula-current bg-dracula-bg-darker px-3 py-2 text-dracula-fg outline-none focus:border-dracula-purple"
        />
        {error ? <p className="text-sm text-dracula-red">{error}</p> : null}
        {loading ? (
          <p className="text-dracula-comment">Yükleniyor…</p>
        ) : (
          <ul className="divide-y divide-dracula-current rounded-lg border border-dracula-current">
            {users.length === 0 ? (
              <li className="px-4 py-6 text-center text-dracula-comment">Sonuç yok</li>
            ) : (
              users.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-dracula-fg">{u.displayName ?? u.username}</p>
                    <p className="text-sm text-dracula-comment">@{u.username}</p>
                  </div>
                  <code className="text-xs text-dracula-cyan">{u.id}</code>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
