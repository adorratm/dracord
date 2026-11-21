'use client';

import { useState } from 'react';
import type { ActivitySessionDto } from '@dracord/types';
import { cn } from '../lib/cn';

/**
 * Oyun odası lobisi (ses/oyun kanalına bağlı oturum): oyuncular "hazırım" der, host isterse oyunu
 * herkes hazır olana kadar bekletir ya da "Başlat"a basar; davet bağlantısı kopyalanır.
 * Oyun başladıktan sonra görünmez.
 */
export function ActivityLobby({
  session,
  meId,
  names,
  inviteUrl,
  onReady,
  onWaitForReady,
  onStart,
  className,
}: {
  session: ActivitySessionDto;
  meId: string | null;
  names: Map<string, string> | Record<string, string>;
  inviteUrl: string;
  onReady: (ready: boolean) => Promise<unknown>;
  onWaitForReady: (wait: boolean) => Promise<unknown>;
  onStart: () => Promise<unknown>;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (session.status !== 'lobby' || session.kind === 'watch_party') return null;
  const nameOf = (id: string) => (names instanceof Map ? names.get(id) : names[id]) ?? 'Oyuncu';
  const ready = new Set(session.readyIds ?? []);
  const isHost = meId === session.hostUserId;
  const isPlayer = Boolean(meId && session.playerIds.includes(meId));
  const meReady = Boolean(meId && ready.has(meId));
  const enough = session.playerIds.length >= session.minPlayers;
  const allReady = session.playerIds.length > 0 && session.playerIds.every((p) => ready.has(p));
  const run = (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    void fn()
      .catch((e) => setErr(e instanceof Error ? e.message : 'İşlem başarısız'))
      .finally(() => setBusy(false));
  };
  const copy = () => {
    void navigator.clipboard?.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className={cn('w-full max-w-md rounded-2xl border border-[#bd93f9]/40 bg-[#11131e]/95 p-4 shadow-xl', className)} role="region" aria-label="Oyun lobisi">
      <div className="mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-[#bd93f9]" aria-hidden>
          groups
        </span>
        <h3 className="flex-1 font-label-md text-on-surface">
          Lobi · {session.playerIds.length}/{session.maxPlayers} oyuncu
          {session.spectatorIds.length ? ` · ${session.spectatorIds.length} izleyici` : ''}
        </h3>
        <button type="button" onClick={copy} className="flex items-center gap-1 rounded-lg px-2 py-1 font-label-sm text-on-surface-variant hover:bg-surface-container-high" title={inviteUrl}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            {copied ? 'check' : 'link'}
          </span>
          {copied ? 'Kopyalandı' : 'Davet'}
        </button>
      </div>
      <ul className="mb-3 space-y-1">
        {session.playerIds.map((id) => (
          <li key={id} className="flex items-center gap-2 font-body-sm">
            <span className={cn('material-symbols-outlined text-[18px]', ready.has(id) ? 'text-[#50fa7b]' : 'text-outline')} aria-hidden>
              {ready.has(id) ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <span className="min-w-0 flex-1 truncate text-on-surface">
              {nameOf(id)}
              {id === session.hostUserId ? <span className="ml-1 text-[#ffb86c]" title="Oda sahibi">★</span> : null}
              {id === meId ? <span className="text-outline"> (sen)</span> : null}
            </span>
            <span className="font-label-sm text-outline">{ready.has(id) ? 'hazır' : 'bekleniyor'}</span>
          </li>
        ))}
        {Array.from({ length: Math.max(0, session.minPlayers - session.playerIds.length) }, (_, i) => (
          <li key={`empty-${i}`} className="flex items-center gap-2 font-body-sm text-outline">
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              person_add
            </span>
            boş koltuk
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        {isPlayer ? (
          <button
            type="button"
            disabled={busy}
            aria-pressed={meReady}
            onClick={() => run(() => onReady(!meReady))}
            className={cn('h-9 rounded-lg px-4 font-label-md disabled:opacity-50', meReady ? 'bg-surface-container-high text-on-surface' : 'bg-[#50fa7b] text-[#11131e]')}
          >
            {meReady ? 'Hazır değilim' : 'Hazırım'}
          </button>
        ) : null}
        {isHost ? (
          <>
            <button
              type="button"
              disabled={busy || !enough}
              onClick={() => run(onStart)}
              className="h-9 rounded-lg bg-[#bd93f9] px-4 font-label-md text-[#11131e] disabled:opacity-50"
              title={enough ? 'Oyunu şimdi başlat' : `En az ${session.minPlayers} oyuncu gerekli`}
            >
              Başlat
            </button>
            <label className="flex items-center gap-1.5 font-label-sm text-on-surface-variant">
              <input type="checkbox" checked={Boolean(session.waitForReady)} disabled={busy} onChange={(e) => run(() => onWaitForReady(e.target.checked))} />
              Herkes hazır olunca başla
            </label>
          </>
        ) : null}
      </div>
      <p className="mt-2 font-body-sm text-outline">
        {!enough
          ? `${session.minPlayers - session.playerIds.length} oyuncu daha gerekli.`
          : session.waitForReady
            ? allReady
              ? 'Herkes hazır — başlıyor…'
              : 'Oda sahibi herkesin hazır olmasını bekliyor.'
            : 'Yeterli oyuncu var; oyun ilk hamlede başlar.'}
      </p>
      {err ? <p className="mt-1 font-body-sm text-error">{err}</p> : null}
    </div>
  );
}
