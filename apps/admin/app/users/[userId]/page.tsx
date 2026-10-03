'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import {
  banAdminUserFromGuild,
  deleteAdminUser,
  disableAdminUser,
  enableAdminUser,
  getAdminUser,
  kickAdminUserAllGuilds,
  revokeAdminUserSessions,
  timeoutAdminUser,
  unbanAdminUserFromGuild,
  updateAdminUser,
  type PlatformAdminUserDetail,
} from '@/lib/api';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = String(params.userId ?? '');
  const [user, setUser] = useState<PlatformAdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');

  const [modGuildId, setModGuildId] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState('60');
  const [banReason, setBanReason] = useState('');

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const u = await getAdminUser(userId);
      setUser(u);
      setDisplayName(u.displayName);
      setUsername(u.username);
      setEmail(u.email);
      setBio(u.bio ?? '');
      setModGuildId((prev) => prev || u.guilds[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <a href="/users" className="cursor-pointer text-sm text-dracula-cyan hover:underline">
            ← Kullanıcılar
          </a>
          <h2 className="mt-2 text-xl font-semibold text-dracula-fg">
            {user?.displayName ?? 'Kullanıcı'}
          </h2>
          {user ? (
            <p className="mt-1 text-sm text-dracula-comment">
              @{user.username} · <code className="text-xs">{user.id}</code>
            </p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-dracula-red whitespace-pre-wrap">{error}</p> : null}
        {loading ? <p className="text-dracula-comment">Yükleniyor…</p> : null}

        {!loading && user ? (
          <>
            <div className="flex flex-wrap gap-2">
              {user.disabledAt ? (
                <span className="rounded bg-dracula-red/20 px-2 py-1 text-xs text-dracula-red">
                  Engelli · {new Date(user.disabledAt).toLocaleString('tr-TR')}
                </span>
              ) : (
                <span className="rounded bg-dracula-green/20 px-2 py-1 text-xs text-dracula-green">
                  Aktif
                </span>
              )}
              {user.isPlatformAdmin ? (
                <span className="rounded bg-dracula-purple/20 px-2 py-1 text-xs text-dracula-purple">
                  Platform admin
                </span>
              ) : null}
              <span className="rounded bg-dracula-current/40 px-2 py-1 text-xs text-dracula-comment">
                {user.sessionCount} oturum · {user.guildCount} sunucu
              </span>
            </div>

            <section className="space-y-3 rounded-lg border border-dracula-current p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
                Profil düzenle
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="text-dracula-comment">Görünen ad</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="h-9 w-full rounded border border-dracula-current bg-dracula-bg px-2 text-dracula-fg"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-dracula-comment">Kullanıcı adı</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-9 w-full rounded border border-dracula-current bg-dracula-bg px-2 text-dracula-fg"
                  />
                </label>
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="text-dracula-comment">E-posta</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 w-full rounded border border-dracula-current bg-dracula-bg px-2 text-dracula-fg"
                  />
                </label>
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="text-dracula-comment">Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-dracula-current bg-dracula-bg px-2 py-1 text-dracula-fg"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy}
                className="rounded bg-dracula-purple px-3 py-1.5 text-sm disabled:opacity-50"
                onClick={() =>
                  void run(async () => {
                    await updateAdminUser(userId, {
                      displayName: displayName.trim(),
                      username: username.trim(),
                      email: email.trim(),
                      bio: bio.trim() || null,
                    });
                  })
                }
              >
                Kaydet
              </button>
            </section>

            <section className="space-y-3 rounded-lg border border-dracula-current p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
                Hesap işlemleri
              </h3>
              <div className="flex flex-wrap gap-2">
                {user.disabledAt ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-dracula-green px-3 py-1.5 text-sm text-dracula-green hover:bg-dracula-green/10 disabled:opacity-50"
                    onClick={() => void run(async () => { await enableAdminUser(userId); })}
                  >
                    Engeli kaldır
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || user.isPlatformAdmin}
                    className="rounded border border-dracula-orange px-3 py-1.5 text-sm text-dracula-orange hover:bg-dracula-orange/10 disabled:opacity-50"
                    onClick={() => {
                      if (!window.confirm('Hesap engellensin mi? Giriş kapanır, oturumlar düşer.'))
                        return;
                      void run(async () => { await disableAdminUser(userId); });
                    }}
                  >
                    Engelle (platform ban)
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-dracula-cyan px-3 py-1.5 text-sm text-dracula-cyan hover:bg-dracula-cyan/10 disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      const r = await revokeAdminUserSessions(userId);
                      window.alert(`${r.revoked} oturum sonlandırıldı`);
                    })
                  }
                >
                  Oturumları düşür
                </button>
                <button
                  type="button"
                  disabled={busy || user.isPlatformAdmin}
                  className="rounded border border-dracula-pink px-3 py-1.5 text-sm text-dracula-pink hover:bg-dracula-pink/10 disabled:opacity-50"
                  onClick={() => {
                    if (!window.confirm('Tüm sunuculardan atılsın mı? (sahip olduğu hariç)'))
                      return;
                    void run(async () => {
                      const r = await kickAdminUserAllGuilds(userId);
                      window.alert(`${r.kicked} sunucudan atıldı`);
                    });
                  }}
                >
                  Tüm sunuculardan at
                </button>
                <button
                  type="button"
                  disabled={busy || user.isPlatformAdmin}
                  className="rounded border border-dracula-red px-3 py-1.5 text-sm text-dracula-red hover:bg-dracula-red/10 disabled:opacity-50"
                  onClick={() => {
                    if (
                      !window.confirm(
                        'HESAP KALICI SİLİNECEK. Mesajlar ve üyelikler de silinir. Emin misin?',
                      )
                    )
                      return;
                    if (!window.confirm(`Son onay: @${user.username} silinsin mi?`)) return;
                    void run(async () => {
                      await deleteAdminUser(userId);
                      router.push('/users');
                    });
                  }}
                >
                  Hesabı sil
                </button>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-dracula-current p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
                Sunucu moderasyonu
              </h3>
              <div className="flex flex-wrap items-end gap-2">
                <label className="space-y-1 text-sm">
                  <span className="text-dracula-comment">Sunucu</span>
                  <select
                    value={modGuildId}
                    onChange={(e) => setModGuildId(e.target.value)}
                    className="block h-9 min-w-[12rem] rounded border border-dracula-current bg-dracula-bg px-2 text-dracula-fg"
                  >
                    <option value="">Seç…</option>
                    {user.guilds.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                        {g.owner ? ' (sahip)' : ''}
                        {g.banned ? ' [banlı]' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-dracula-comment">Uzaklaştırma (dk)</span>
                  <select
                    value={timeoutMinutes}
                    onChange={(e) => setTimeoutMinutes(e.target.value)}
                    className="block h-9 rounded border border-dracula-current bg-dracula-bg px-2 text-dracula-fg"
                  >
                    {[0, 5, 10, 60, 1440, 10080].map((m) => (
                      <option key={m} value={m}>
                        {m === 0 ? 'Kaldır' : m < 60 ? `${m} dk` : m < 1440 ? `${m / 60} saat` : `${m / 1440} gün`}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || !modGuildId || user.isPlatformAdmin}
                  className="h-9 rounded border border-dracula-orange px-3 text-sm text-dracula-orange disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      await timeoutAdminUser(userId, modGuildId, Number(timeoutMinutes));
                    })
                  }
                >
                  Uzaklaştır
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="space-y-1 text-sm flex-1 min-w-[12rem]">
                  <span className="text-dracula-comment">Ban sebebi</span>
                  <input
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="İsteğe bağlı"
                    className="h-9 w-full rounded border border-dracula-current bg-dracula-bg px-2 text-dracula-fg"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !modGuildId || user.isPlatformAdmin}
                  className="h-9 rounded border border-dracula-red px-3 text-sm text-dracula-red disabled:opacity-50"
                  onClick={() => {
                    if (!window.confirm('Bu sunucudan yasaklansın mı?')) return;
                    void run(async () => {
                      await banAdminUserFromGuild(userId, modGuildId, banReason.trim() || undefined);
                      setBanReason('');
                    });
                  }}
                >
                  Sunucudan banla
                </button>
                <button
                  type="button"
                  disabled={busy || !modGuildId}
                  className="h-9 rounded border border-dracula-green px-3 text-sm text-dracula-green disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      await unbanAdminUserFromGuild(userId, modGuildId);
                    })
                  }
                >
                  Ban kaldır
                </button>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
                Sunucular
              </h3>
              {user.guilds.length === 0 ? (
                <p className="text-sm text-dracula-comment">Üyelik yok</p>
              ) : (
                <ul className="divide-y divide-dracula-current rounded-lg border border-dracula-current">
                  {user.guilds.map((g) => (
                    <li
                      key={g.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
                    >
                      <div>
                        <a
                          href={`/guilds/${g.id}`}
                          className="cursor-pointer font-medium text-dracula-fg hover:underline"
                        >
                          {g.name}
                        </a>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-dracula-comment">
                          {g.owner ? <span>sahip</span> : null}
                          {g.banned ? (
                            <span className="text-dracula-red">banlı</span>
                          ) : null}
                          {g.timeoutUntil ? (
                            <span className="text-dracula-orange">
                              timeout → {new Date(g.timeoutUntil).toLocaleString('tr-TR')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-dracula-cyan hover:underline"
                        onClick={() => setModGuildId(g.id)}
                      >
                        Seç
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
