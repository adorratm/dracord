'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { AdminSearchBar } from '@/components/AdminSearchBar';
import {
  disableAdminUser,
  enableAdminUser,
  listAdminUsers,
  type PlatformAdminUserRow,
} from '@/lib/api';

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PlatformAdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listAdminUsers(q, 100));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Liste alınamadı');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => void reload(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const toggleDisable = async (u: PlatformAdminUserRow) => {
    if (u.isPlatformAdmin) {
      setError('Platform admin engellenemez');
      return;
    }
    const label = u.disabledAt ? 'etkinleştir' : 'engelle (giriş kapat)';
    if (!window.confirm(`@${u.username} hesabını ${label}?`)) return;
    setBusyId(u.id);
    setError(null);
    try {
      const updated = u.disabledAt
        ? await enableAdminUser(u.id)
        : await disableAdminUser(u.id);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-dracula-fg">Kullanıcılar</h2>
          <p className="text-sm text-dracula-comment">
            Arama, engelleme, düzenleme, sunucu ban/uzaklaştırma ve hesap silme.
          </p>
        </div>
        <AdminSearchBar
          placeholder="Elasticsearch: kullanıcı / mesaj ara…"
          types={['users', 'messages']}
          className="mb-2"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kullanıcı adı, görünen ad veya e-posta (DB)…"
          className="w-full max-w-md rounded border border-dracula-current bg-dracula-bg-darker px-3 py-2 text-dracula-fg outline-none focus:border-dracula-purple"
        />
        {error ? <p className="text-sm text-dracula-red whitespace-pre-wrap">{error}</p> : null}
        {loading ? (
          <p className="text-dracula-comment">Yükleniyor…</p>
        ) : (
          <ul className="divide-y divide-dracula-current rounded-lg border border-dracula-current">
            {users.length === 0 ? (
              <li className="px-4 py-6 text-center text-dracula-comment">Sonuç yok</li>
            ) : (
              users.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-dracula-fg">
                        {u.displayName ?? u.username}
                      </p>
                      {u.disabledAt ? (
                        <span className="rounded bg-dracula-red/20 px-1.5 py-0.5 text-xs text-dracula-red">
                          engelli
                        </span>
                      ) : null}
                      {u.isPlatformAdmin ? (
                        <span className="rounded bg-dracula-purple/20 px-1.5 py-0.5 text-xs text-dracula-purple">
                          admin
                        </span>
                      ) : null}
                      {u.isBot ? (
                        <span className="rounded bg-dracula-cyan/20 px-1.5 py-0.5 text-xs text-dracula-cyan">
                          bot
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-dracula-comment">
                      @{u.username} · {u.email} · {u.guildCount} sunucu
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/users/${u.id}`}
                      className="rounded border border-dracula-cyan px-2 py-1 text-xs text-dracula-cyan hover:bg-dracula-cyan/10"
                    >
                      Yönet
                    </Link>
                    <button
                      type="button"
                      disabled={Boolean(busyId) || u.isPlatformAdmin}
                      onClick={() => void toggleDisable(u)}
                      className="rounded border border-dracula-orange px-2 py-1 text-xs text-dracula-orange hover:bg-dracula-orange/10 disabled:opacity-40"
                    >
                      {u.disabledAt ? 'Etkinleştir' : 'Engelle'}
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
