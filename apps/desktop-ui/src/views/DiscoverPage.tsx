import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DISCOVER_CATEGORIES,
  type DiscoverCategory,
  type GuildSummary,
} from '@dracord/types';
import { cn, DiscoverSkeleton } from '@dracord/ui';
import { useAuth } from '../auth';
import { Draco, DracoEmpty } from '../components/Draco';

const CATEGORIES = [
  { id: 'all' as const, label: 'Ana Sayfa' },
  ...DISCOVER_CATEGORIES,
];

type DiscoverView = 'servers' | 'apps';

type CuratedApp = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  gradient: string;
  kind: 'game' | 'utility';
  gameChannelHint?: string;
};

const CURATED_APPS: CuratedApp[] = [
  {
    id: 'billiards',
    name: 'Bilardo',
    tagline: 'Masada rastgele oyun',
    description: 'Sunucundaki oyun kanalında bilardo masası aç ve arkadaşlarınla oyna.',
    icon: 'sports_bar',
    gradient: 'from-emerald-700/80 via-teal-800/50 to-surface-container-high',
    kind: 'game',
    gameChannelHint: 'billiards',
  },
  {
    id: 'okey',
    name: 'Okey',
    tagline: 'Klasik masa oyunu',
    description: 'Dört kişilik okey masası — oyun kanalından Başlat.',
    icon: 'grid_view',
    gradient: 'from-amber-700/70 via-orange-900/40 to-surface-container-high',
    kind: 'game',
    gameChannelHint: 'okey',
  },
  {
    id: 'blackjack',
    name: '21 Blackjack',
    tagline: 'Kurpiyere karşı',
    description: '4 kişilik blackjack masası — kart al, dur, double.',
    icon: 'style',
    gradient: 'from-emerald-800/70 via-green-950/50 to-surface-container-high',
    kind: 'game',
    gameChannelHint: 'blackjack',
  },
  {
    id: 'watch',
    name: 'Watch Party',
    tagline: 'Birlikte izle',
    description: 'Watch Party kanalında video senkronu ve sohbet.',
    icon: 'live_tv',
    gradient: 'from-indigo-700/70 via-violet-900/40 to-surface-container-high',
    kind: 'utility',
  },
  {
    id: 'music',
    name: 'Müzik Botu',
    tagline: 'Ses kanalında çal',
    description: 'Slash komutlarıyla kuyruk, ses seviyesi ve kontroller (demo katalog).',
    icon: 'music_note',
    gradient: 'from-rose-700/60 via-pink-900/40 to-surface-container-high',
    kind: 'utility',
  },
  {
    id: 'polls',
    name: 'Anketler',
    tagline: 'Hızlı oylama',
    description: 'Metin kanalında kısa anketler oluştur (kürate demo).',
    icon: 'ballot',
    gradient: 'from-sky-700/60 via-cyan-900/40 to-surface-container-high',
    kind: 'utility',
  },
];

const DEFAULT_BANNER = 'https://dracord.com.tr/guild-banner-default.webp';

function formatCount(n: number): string {
  return new Intl.NumberFormat('tr-TR').format(n);
}

function guildInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function DiscoverPage({
  guilds = [],
  onJoined,
  onOpenChannel,
}: {
  guilds?: GuildSummary[];
  onJoined?: (guildId: string) => void;
  onOpenChannel?: (guildId: string, channelId: string) => void;
}) {
  const { client } = useAuth();
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
      onJoined?.(joined.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Katılınamadı');
    } finally {
      setBusyId(null);
    }
  };

  const launchApp = async (app: CuratedApp) => {
    if (!guilds[0]) {
      setError('Önce bir sunucuya katıl veya oluştur.');
      return;
    }
    setBusyId(app.id);
    try {
      const guildId = guilds[0].id;
      const chs = await client.getGuildChannels(guildId);
      const hint = app.gameChannelHint;
      const target =
        (hint
          ? chs.find(
              (c) =>
                c.type === 'GAME' &&
                (c.gameKind ?? '').toLowerCase().includes(hint),
            )
          : undefined) ??
        chs.find((c) => c.type === (app.id === 'watch' ? 'WATCH_PARTY' : 'GAME')) ??
        chs.find((c) => c.type === 'GAME' || c.type === 'WATCH_PARTY') ??
        chs.find((c) => c.type === 'VOICE') ??
        chs.find((c) => c.type === 'TEXT');
      if (target) onOpenChannel?.(guildId, target.id);
      else setError('Uygun kanal bulunamadı.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Açılamadı');
    } finally {
      setBusyId(null);
    }
  };

  if (!initialReady || (view === 'servers' && loading && discover.length === 0)) {
    return (
      <div className="flex flex-1 min-h-0 min-w-0 h-full">
        <DiscoverSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0 h-full overflow-hidden">
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
            Uygulamalar
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
              onClick={() => {
                setView('apps');
                setSelectedApp(null);
              }}
              className={cn(
                'h-8 px-3 rounded-lg font-label-sm',
                view === 'apps'
                  ? 'bg-surface-container-high text-on-surface'
                  : 'text-on-surface-variant',
              )}
            >
              Uygulamalar
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
                />
              </div>
            </div>

            <div className="px-3 md:px-6 py-6">
              <h2 className="font-headline-md text-on-surface mb-4">Öne çıkan sunucular</h2>
              {error && <p className="mb-3 font-body-sm text-error">{error}</p>}
              {discover.length === 0 ? (
                <DracoEmpty
                  mood="confused"
                  size={120}
                  title={query.trim() ? 'Sonuç yok' : 'Keşfedilecek sunucu yok'}
                  description="Keşfette gösterilen sunucular burada listelenir."
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
                            backgroundImage: `url(${g.bannerUrl || DEFAULT_BANNER})`,
                          }}
                        />
                        <div className="relative px-3 pb-3 pt-6">
                          <div className="absolute -top-6 left-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border-4 border-surface-container-low bg-surface-container-high font-label-md text-on-surface shadow-md">
                            {g.iconUrl ? (
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
                      Uygulama dizini
                    </h1>
                    <p className="mt-2 font-body-md text-on-primary-container/90">
                      Kürate demo katalog — oyun kanalları ve yardımcılar.
                    </p>
                  </div>
                  <Draco
                    size={140}
                    mood="wave"
                    glow
                    className="hidden sm:block shrink-0 drop-shadow-lg"
                  />
                </div>
              </div>
              <div className="px-3 md:px-6 py-6">
              {error && <p className="mb-3 font-body-sm text-error">{error}</p>}
              {filteredApps.length === 0 ? (
                <DracoEmpty
                  mood="confused"
                  size={120}
                  title="Uygulama bulunamadı"
                  description="Aramayı değiştirmeyi dene."
                />
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
                      disabled={busyId === selectedApp.id}
                      onClick={() => void launchApp(selectedApp)}
                      className="h-10 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-60"
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
  );
}
