'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameAppDto, GameSessionDto } from '@dracord/types';
import { cn } from '../lib/cn';

/** Ses odası kontrol çubuğu: oyun başlat / aktif oyuna katıl */
export function GamesLauncherButton({
  loadCatalog,
  sessions,
  openSessionId,
  platform,
  onStart,
  onJoin,
  onReopen,
  error,
}: {
  loadCatalog: () => Promise<Array<GameAppDto & { testMode: boolean }>>;
  sessions: GameSessionDto[];
  openSessionId?: string | null;
  platform: 'web' | 'desktop' | 'mobile';
  onStart: (gameId: string) => void;
  onJoin: (sessionId: string) => void;
  onReopen: (sessionId: string) => void;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<Array<GameAppDto & { testMode: boolean }> | null>(null);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || catalog) return;
    void loadCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, [open, catalog, loadCatalog]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const playable = (catalog ?? []).filter((g) => g.platforms.includes(platform));

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200',
          open ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface hover:bg-surface-bright',
        )}
        aria-label="Oyunlar"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[24px]">sports_esports</span>
        {sessions.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-dracula-green px-1 font-label-sm text-[10px] leading-4 text-black">
            {sessions.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[60] w-[min(24rem,92vw)] max-h-[60vh] overflow-y-auto rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float p-3 flex flex-col gap-3">
          {sessions.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h4 className="font-label-md text-on-surface">Bu kanalda oynanıyor</h4>
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg bg-surface-container px-2 py-1.5">
                  <span className="font-label-md text-on-surface truncate flex-1">{s.game.name}</span>
                  <span className="font-label-sm text-outline">{s.participantIds.length} oyuncu</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (s.id === openSessionId) onReopen(s.id);
                      else onJoin(s.id);
                    }}
                    className="h-7 px-3 rounded-md bg-dracula-green/90 font-label-sm text-black"
                  >
                    {s.id === openSessionId ? 'Aç' : 'Katıl'}
                  </button>
                </div>
              ))}
            </section>
          )}
          <section className="flex flex-col gap-1.5">
            <h4 className="font-label-md text-on-surface">Oyun başlat</h4>
            {catalog === null ? (
              <p className="font-body-sm text-outline">Yükleniyor…</p>
            ) : playable.length === 0 ? (
              <p className="font-body-sm text-outline">Bu platformda henüz yayında oyun yok.</p>
            ) : (
              playable.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onStart(g.id);
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-container"
                >
                  {g.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.iconUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  ) : (
                    <span className="h-9 w-9 rounded-lg bg-surface-container-highest flex items-center justify-center material-symbols-outlined text-[20px]">
                      sports_esports
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-label-md text-on-surface truncate">
                      {g.name}
                      {g.testMode && <span className="ml-1 font-label-sm text-dracula-orange">TEST</span>}
                    </span>
                    <span className="block font-body-sm text-outline truncate">
                      {g.shortDescription || `${g.minPlayers}–${g.maxPlayers} oyuncu`}
                    </span>
                  </span>
                </button>
              ))
            )}
          </section>
          {error && <p className="font-label-sm text-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
