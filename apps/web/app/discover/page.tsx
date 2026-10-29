'use client';

import {
  DISCOVER_CATEGORIES,
  DISCOVER_CURATED_APPS,
  type DiscoverCategory,
  type DiscoverCuratedApp,
  type GuildSummary,
} from '@dracord/types';
import { cn, DiscoverSkeleton } from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell, rememberChannel } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { Draco } from '@/components/Draco';
import { useGuildNav, invalidateGuildNavCache, prefetchGuildNav } from '@/hooks/useGuildNav';
import { trackDiscoverJoin } from '@/lib/analytics';

const CATEGORIES = [
  { id: 'all' as const, label: 'Ana Sayfa' },
  ...DISCOVER_CATEGORIES,
];

type DiscoverView = 'servers' | 'apps';

type CuratedApp = DiscoverCuratedApp;

const CURATED_APPS = DISCOVER_CURATED_APPS;

function formatCount(n: number): string {
  return new Intl.NumberFormat('tr-TR').format(n);
}

function guildInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function DracoEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Draco size={120} mood="confused" className="mb-4" aria-label="Draco" />
      <p className="font-headline-md text-on-surface">{title}</p>
      <p className="mt-2 font-body-sm text-on-surface-variant max-w-sm">{hint}</p>
    </div>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const { client } = useAuth();
  const { guilds, reload } = useGuildNav(undefined);
  const [view, setView] = useState<DiscoverView>('servers');
  const [discover, setDiscover] = useState<GuildSummary[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<CuratedApp | null>(null);
  const [addedApps, setAddedApps] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [initialReady, setInitialReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cat = category === 'all' ? undefined : (category as DiscoverCategory);
      const list = await client.discoverGuilds(query.trim() || undefined, cat);
      setDiscover(list);
      setError(null);
    } catch (e) {
      setDiscover([]);
      setError(e instanceof Error ? e.message : 'Keşfet yüklenemedi');
    } finally {
      setLoading(false);
      setInitialReady(true);
    }
  }, [client, query, category]);

  useEffect(() => {
    if (view !== 'servers') {
      setLoading(false);
      setInitialReady(true);
      return;
    }
    const t = window.setTimeout(() => void load(), 120);
    return () => window.clearTimeout(t);
  }, [load, view]);

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURATED_APPS;
    return CURATED_APPS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }, [query]);

  const join = async (g: GuildSummary) => {
    setBusyId(g.id);
    setError(null);
    try {
      const joined = await client.joinDiscoverableGuild(g.id);
      trackDiscoverJoin(joined.id);
      void client
        .trackFunnel('discover_join', { guildId: joined.id })
        .catch(() => undefined);
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

  const launchApp = (app: CuratedApp) => {
    const g = guilds[0];
    if (!g) {
      setError('Önce bir sunucuya katıl veya oluştur.');
      return;
    }
    void (async () => {
      try {
        const snap = await prefetchGuildNav(client, g.id);
        const game =
          snap?.channels.find(
            (c) =>
              c.type === 'GAME' &&
              (!app.gameChannelHint ||
                (c.gameKind ?? '').toLowerCase().includes(app.gameChannelHint)),
          ) ?? snap?.channels.find((c) => c.type === 'GAME' || c.type === 'WATCH_PARTY');
        if (game) {
          rememberChannel(g.id, game.id);
          router.push(`/channels/${g.id}/${game.id}`);
        } else {
          router.push(`/channels/${g.id}`);
        }
      } catch {
        router.push(`/channels/${g.id}`);
      }
    })();
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
        {!initialReady || (view === 'servers' && loading && discover.length === 0) ? (
          <DiscoverSkeleton />
        ) : (
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <aside className="hidden md:flex w-60 shrink-0 flex-col bg-surface-container-low border-r border-surface-container-highest">
            <div className="px-4 py-4 border-b border-surface-container-highest">
              <p className="font-headline-md text-on-surface">Keşfet</p>
            </div>
            <nav className="p-2 flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setView('servers')}
                className={cn(
                  'h-10 px-3 rounded-lg font-label-md text-left',
                  view === 'servers'
                    ? 'bg-surface-container-high text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container',
                )}
              >
                Sunucular
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('apps');
                  setSelectedApp(null);
                }}
                className={cn(
                  'h-10 px-3 rounded-lg font-label-md text-left',
                  view === 'apps'
                    ? 'bg-surface-container-high text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container',
                )}
              >
                Aktiviteler
              </button>
            </nav>
          </aside>

          <div className="flex-1 min-w-0 overflow-y-auto bg-surface">
            <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-surface-container-highest">
              <div className="flex md:hidden items-center gap-1 px-3 pt-2">
                <button
                  type="button"
                  onClick={() => setView('servers')}
                  className={cn(
                    'h-8 px-3 rounded-lg font-label-sm',
                    view === 'servers'
                      ? 'bg-surface-container-high text-on-surface'
                      : 'text-on-surface-variant',
                  )}
                >
                  Sunucular
                </button>
                <button
                  type="button"
                  onClick={() => setView('apps')}
                  className={cn(
                    'h-8 px-3 rounded-lg font-label-sm',
                    view === 'apps'
                      ? 'bg-surface-container-high text-on-surface'
                      : 'text-on-surface-variant',
                  )}
                >
                  Aktiviteler
                </button>
              </div>
              <div className="flex items-center gap-1 px-3 md:px-6 py-2 overflow-x-auto">
                {view === 'servers' &&
                  CATEGORIES.map((c) => (
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

            {view === 'servers' ? (
              <>
                <div className="relative mx-3 md:mx-6 mt-4 overflow-hidden rounded-2xl min-h-[200px] md:min-h-[260px]">
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary-container/90 via-primary-container/50 to-surface-container-lowest" />
                  <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
                  <div className="relative flex items-end md:items-center justify-between gap-4 px-6 py-10 md:py-14">
                    <div className="min-w-0 max-w-xl">
                      <p className="font-label-sm uppercase tracking-wider text-on-primary-container/80 mb-2">
                        Dracord
                      </p>
                      <h1 className="font-headline-lg text-on-primary-container text-2xl md:text-4xl font-bold">
                        Topluluğunu bul
                      </h1>
                      <p className="mt-2 font-body-md text-on-primary-container/90">
                        Oyun, müzik ve eğitim — senin için bir sunucu var.
                      </p>
                    </div>
                    <Draco
                      size={140}
                      mood="happy"
                      glow
                      className="hidden sm:block shrink-0 drop-shadow-lg"
                      aria-label="Draco"
                    />
                  </div>
                </div>

                <div className="px-3 md:px-6 py-6">
                  <h2 className="font-headline-md text-on-surface mb-4">
                    Öne çıkan sunucular
                  </h2>
                  <p className="mb-4 font-body-sm text-on-surface-variant">
                    Keşfedilebilir topluluklar — pin’liler önce, ardından üye sayısına göre.
                  </p>
                  {error && <p className="mb-3 font-body-sm text-error">{error}</p>}
                  {discover.length === 0 ? (
                    <DracoEmpty
                      title={query.trim() ? 'Sonuç yok' : 'Keşfedilecek sunucu yok'}
                      hint="Keşfette gösterilen sunucular burada listelenir."
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {discover.map((g) => {
                        const members = g.memberCount ?? 0;
                        const online = Math.max(1, Math.round(members * 0.12));
                        return (
                          <button
                            key={g.id}
                            type="button"
                            disabled={busyId === g.id}
                            onClick={() => void join(g)}
                            className="text-left rounded-xl overflow-hidden bg-surface-container-low border border-surface-container-highest hover:border-outline-variant/40 transition-colors disabled:opacity-60"
                          >
                            <div
                              className="h-28 w-full bg-cover bg-center bg-surface-container-highest"
                              style={{
                                backgroundImage: `url(${g.bannerUrl || '/guild-banner-default.webp'})`,
                              }}
                            />
                            <div className="relative px-3 pb-3 pt-6">
                              <div className="absolute -top-6 left-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border-4 border-surface-container-low bg-surface-container-high font-label-md text-on-surface shadow-md">
                                {g.iconUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={g.iconUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  guildInitials(g.name)
                                )}
                              </div>
                              <div className="flex min-w-0 items-center gap-1.5 pl-14">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-dracula-green" />
                                <p className="truncate font-label-md font-semibold text-on-surface">
                                  {g.name}
                                </p>
                              </div>
                              <p className="mt-1 font-body-sm text-on-surface-variant line-clamp-2 min-h-[2.5rem]">
                                {(g.discoverCategory &&
                                  DISCOVER_CATEGORIES.find((c) => c.id === g.discoverCategory)
                                    ?.label) ||
                                  'Oyun'}{' '}
                                · {formatCount(members)} üye
                              </p>
                              <div className="mt-2 flex items-center gap-3 font-label-sm text-outline">
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-dracula-green" />
                                  {formatCount(online)} Çevrimiçi
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col lg:flex-row min-h-[calc(100%-3rem)]">
                <div className="flex-1 min-w-0">
                  <div className="relative mx-3 md:mx-6 mt-4 overflow-hidden rounded-2xl min-h-[200px] md:min-h-[260px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary-container/90 via-primary-container/50 to-surface-container-lowest" />
                    <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
                    <div className="relative flex items-end md:items-center justify-between gap-4 px-6 py-10 md:py-14">
                      <div className="min-w-0 max-w-xl">
                        <p className="font-label-sm uppercase tracking-wider text-on-primary-container/80 mb-2">
                          Dracord
                        </p>
                        <h1 className="font-headline-lg text-on-primary-container text-2xl md:text-4xl font-bold">
                          Aktivite kısayolları
                        </h1>
                        <p className="mt-2 font-body-md text-on-primary-container/90">
                          Yerleşik oyun / watch party kısayolları — sunucu mağazası değil; mevcut sunucundaki kanallara gider.
                        </p>
                      </div>
                      <Draco
                        size={140}
                        mood="wave"
                        glow
                        className="hidden sm:block shrink-0 drop-shadow-lg"
                        aria-label="Draco"
                      />
                    </div>
                  </div>
                  <div className="px-3 md:px-6 py-6">
                  {error && <p className="mb-3 font-body-sm text-error">{error}</p>}
                  {filteredApps.length === 0 ? (
                    <DracoEmpty title="Uygulama bulunamadı" hint="Aramayı değiştirmeyi dene." />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredApps.map((app) => (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => setSelectedApp(app)}
                          className={cn(
                            'text-left rounded-xl overflow-hidden border transition-colors',
                            selectedApp?.id === app.id
                              ? 'border-primary-container bg-surface-container'
                              : 'border-surface-container-highest bg-surface-container-low hover:border-outline-variant/40',
                          )}
                        >
                          <div
                            className={cn(
                              'h-24 w-full bg-gradient-to-br flex items-center justify-center',
                              app.gradient,
                            )}
                          >
                            <span className="material-symbols-outlined text-[40px] text-on-surface">
                              {app.icon}
                            </span>
                          </div>
                          <div className="p-3">
                            <p className="font-label-md text-on-surface font-semibold">{app.name}</p>
                            <p className="font-body-sm text-on-surface-variant mt-0.5">
                              {app.tagline}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  </div>
                </div>
                {selectedApp && (
                  <aside className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-surface-container-highest bg-surface-container-low p-4 md:p-6">
                    <div
                      className={cn(
                        'h-28 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4',
                        selectedApp.gradient,
                      )}
                    >
                      <span className="material-symbols-outlined text-[48px] text-on-surface">
                        {selectedApp.icon}
                      </span>
                    </div>
                    <h2 className="font-headline-md text-on-surface">{selectedApp.name}</h2>
                    <p className="mt-2 font-body-sm text-on-surface-variant">
                      {selectedApp.description}
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      {selectedApp.kind === 'game' ? (
                        <button
                          type="button"
                          onClick={() => launchApp(selectedApp)}
                          className="h-10 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
                        >
                          Başlat
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddedApps((prev) => new Set(prev).add(selectedApp.id));
                          }}
                          className="h-10 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
                        >
                          {addedApps.has(selectedApp.id) ? 'Eklendi (demo)' : 'Ekle'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedApp(null)}
                        className="h-10 rounded-lg bg-surface-container-high font-label-sm text-on-surface-variant lg:hidden"
                      >
                        Kapat
                      </button>
                    </div>
                  </aside>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}
