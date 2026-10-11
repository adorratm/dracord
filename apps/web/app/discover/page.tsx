'use client';

import type { GuildSummary } from '@dracord/types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell, rememberChannel } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { useGuildNav, invalidateGuildNavCache, prefetchGuildNav } from '@/hooks/useGuildNav';
import { cn } from '@dracord/ui';

const CATEGORIES = [
  { id: 'all', label: 'Ana Sayfa' },
  { id: 'gaming', label: 'Oyun' },
  { id: 'music', label: 'Müzik' },
  { id: 'fun', label: 'Eğlence' },
  { id: 'tech', label: 'Bilim ve Teknoloji' },
  { id: 'edu', label: 'Eğitim' },
] as const;

function formatCount(n: number): string {
  return new Intl.NumberFormat('tr-TR').format(n);
}

function guildInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function DiscoverPage() {
  const router = useRouter();
  const { client } = useAuth();
  const { guilds, reload } = useGuildNav(undefined);
  const [discover, setDiscover] = useState<GuildSummary[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await client.discoverGuilds(query.trim() || undefined);
      setDiscover(list);
      setError(null);
    } catch (e) {
      setDiscover([]);
      setError(e instanceof Error ? e.message : 'Keşfet yüklenemedi');
    }
  }, [client, query]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const filtered = useMemo(() => {
    if (category === 'all') return discover;
    const q = category.toLowerCase();
    return discover.filter((g) => g.name.toLowerCase().includes(q));
  }, [discover, category]);

  const join = async (g: GuildSummary) => {
    setBusyId(g.id);
    setError(null);
    try {
      const joined = await client.joinDiscoverableGuild(g.id);
      invalidateGuildNavCache(joined.id);
      const snap = await prefetchGuildNav(client, joined.id);
      const ch =
        snap?.channels.find((c) => c.type === 'TEXT') ??
        snap?.channels.find((c) => c.type === 'VOICE') ??
        snap?.channels[0];
      await reload();
      if (ch) {
        rememberChannel(joined.id, ch.id);
        router.push(`/channels/${joined.id}/${ch.id}`);
      } else {
        router.push('/channels/@me');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Katılınamadı');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <RequireAuth>
      <AppShell
        guilds={guilds}
        homeActive={false}
        titleBarNav="servers"
        subtitle="Keşfet"
        onGuildsChanged={() => void reload()}
      >
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <aside className="hidden md:flex w-60 shrink-0 flex-col bg-surface-container-low border-r border-surface-container-highest">
            <div className="px-4 py-4 border-b border-surface-container-highest">
              <p className="font-headline-md text-on-surface">Keşfet</p>
            </div>
            <nav className="p-2 flex flex-col gap-0.5">
              <button
                type="button"
                className="h-10 px-3 rounded-lg bg-surface-container-high text-on-surface font-label-md text-left"
              >
                Sunucular
              </button>
              <button
                type="button"
                disabled
                className="h-10 px-3 rounded-lg text-on-surface-variant font-label-md text-left opacity-50"
              >
                Uygulamalar
              </button>
            </nav>
          </aside>

          <div className="flex-1 min-w-0 overflow-y-auto bg-surface">
            <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-surface-container-highest">
              <div className="flex items-center gap-1 px-3 md:px-6 py-2 overflow-x-auto">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      'shrink-0 h-8 px-3 rounded-lg font-label-sm transition-colors',
                      category === c.id
                        ? 'bg-surface-container-high text-on-surface'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
                <div className="ml-auto shrink-0 relative">
                  <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[18px] text-outline">
                    search
                  </span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ara"
                    className="h-8 w-36 md:w-48 pl-8 pr-2 rounded-lg bg-surface-container-highest font-body-sm text-on-surface outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="relative mx-3 md:mx-6 mt-4 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-container/80 via-secondary-container/60 to-surface-container-high px-6 py-10 md:py-14">
              <h1 className="font-headline-lg text-on-primary-container text-2xl md:text-4xl font-bold max-w-xl">
                TOPLULUĞUNU DRACORD&apos;DA BUL
              </h1>
              <p className="mt-2 font-body-md text-on-primary-container/90 max-w-lg">
                Oyunlardan müziğe ve eğitime kadar burada senin için bir yer var.
              </p>
            </div>

            <div className="px-3 md:px-6 py-6">
              <h2 className="font-headline-md text-on-surface mb-4">Öne çıkan sunucular</h2>
              {error && <p className="mb-3 font-body-sm text-error">{error}</p>}
              {filtered.length === 0 ? (
                <p className="font-body-md text-outline py-12 text-center">
                  {query.trim() ? 'Sonuç bulunamadı.' : 'Keşfedilecek sunucu yok.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {filtered.map((g) => {
                    const members = g.memberCount ?? 0;
                    const online = Math.max(1, Math.round(members * 0.12));
                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={busyId === g.id}
                        onClick={() => void join(g)}
                        className="text-left rounded-xl overflow-hidden bg-surface-container-low border border-surface-container-highest hover:border-outline-variant/40 hover:bg-surface-container transition-colors disabled:opacity-60"
                      >
                        <div
                          className="h-28 w-full bg-surface-container-highest bg-cover bg-center"
                          style={
                            g.bannerUrl
                              ? { backgroundImage: `url(${g.bannerUrl})` }
                              : undefined
                          }
                        />
                        <div className="relative px-3 pb-3 pt-5">
                          <div className="absolute -top-5 left-3 w-12 h-12 rounded-full bg-surface-container-high border-4 border-surface-container-low overflow-hidden flex items-center justify-center font-label-md text-on-surface">
                            {g.iconUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={g.iconUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              guildInitials(g.name)
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-dracula-green shrink-0" />
                            <p className="font-label-md text-on-surface truncate font-semibold">
                              {g.name}
                            </p>
                            {g.discoverPinned && (
                              <span className="material-symbols-outlined text-[14px] text-primary-container">
                                push_pin
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-body-sm text-on-surface-variant line-clamp-2 min-h-[2.5rem]">
                            Herkese açık topluluk · {formatCount(members)} üye
                          </p>
                          <div className="mt-2 flex items-center gap-3 font-label-sm text-outline">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-dracula-green" />
                              {formatCount(online)} Çevrimiçi
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-outline" />
                              {formatCount(members)} Üye
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
