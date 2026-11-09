'use client';

import { useEffect, useState } from 'react';
import type { ChallengesDto, SeasonEntryDto } from '@dracord/types';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';

export type ChallengesClient = {
  getChallenges(guildId: string): Promise<ChallengesDto>;
  claimChallenge(guildId: string, challengeId: string): Promise<ChallengesDto>;
};

const nf = new Intl.NumberFormat('tr-TR');
const ICON = { messages: 'chat', voice: 'mic', xp: 'bolt' } as const;
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const seasonName = (s: string) => {
  const [y, m] = s.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y} sezonu`;
};
function left(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'bitti';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d} gün ${h} sa kaldı` : `${h} sa kaldı`;
}

/** Haftalık görevler + sezon skor tablosu (C3) — web + desktop */
export function ChallengesPanel({ client, guildId, meId }: { client: ChallengesClient; guildId: string; meId: string }) {
  const [data, setData] = useState<ChallengesDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [board, setBoard] = useState<'week' | 'season'>('week');

  useEffect(() => {
    let alive = true;
    void client
      .getChallenges(guildId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Yüklenemedi'));
    return () => {
      alive = false;
    };
  }, [client, guildId]);

  if (err) return <p className="font-body-sm text-error">{err}</p>;
  if (!data) return <p className="font-body-sm text-outline">Görevler yükleniyor…</p>;
  if (!data.enabled) return <p className="font-body-sm text-on-surface-variant">Bu sunucuda seviye sistemi kapalı; görevler ve sezon da kapalı.</p>;

  const rows = board === 'week' ? data.weekly : data.seasonBoard;
  const me = board === 'week' ? { score: data.me.weekScore, rank: data.me.weekRank } : { score: data.me.seasonScore, rank: data.me.seasonRank };

  return (
    <div className="space-y-space-md">
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-body-md font-semibold text-on-surface">Bu haftanın görevleri</h3>
          <span className="font-label-sm text-outline">{left(data.weekEndsAt)}</span>
        </div>
        <ul className="space-y-2">
          {data.challenges.map((c) => {
            const pct = Math.round((c.progress / c.target) * 100);
            return (
              <li key={c.id} className="rounded-xl bg-surface-container-low p-space-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden>
                    {ICON[c.kind]}
                  </span>
                  <span className="flex-1 font-label-md text-on-surface">{c.label}</span>
                  <span className="font-label-sm text-on-surface-variant">+{c.rewardXp} XP</span>
                  {c.claimed ? (
                    <span className="inline-flex items-center gap-0.5 font-label-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-[16px]" aria-hidden>
                        check_circle
                      </span>
                      Alındı
                    </span>
                  ) : c.done ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        setBusy(c.id);
                        void client
                          .claimChallenge(guildId, c.id)
                          .then(setData)
                          .catch((e) => setErr(e instanceof Error ? e.message : 'Alınamadı'))
                          .finally(() => setBusy(null));
                      }}
                      className="rounded-lg bg-primary px-2.5 py-1 font-label-sm text-on-primary disabled:opacity-50"
                    >
                      Ödülü al
                    </button>
                  ) : null}
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-highest"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={c.label}
                >
                  <div className="h-full rounded-full bg-primary-container" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-0.5 font-label-sm text-outline tabular-nums">
                  {nf.format(c.progress)} / {nf.format(c.target)}
                  {c.kind === 'messages' ? ' · dakikada en fazla 1 mesaj sayılır' : ''}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Skor tablosu" className="inline-flex rounded-lg bg-surface-container-high p-0.5">
            {(['week', 'season'] as const).map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={board === b}
                onClick={() => setBoard(b)}
                className={cn(
                  'rounded-md px-3 py-1 font-label-md',
                  board === b ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {b === 'week' ? 'Bu hafta' : seasonName(data.season)}
              </button>
            ))}
          </div>
          <span className="font-label-sm text-outline">
            {me.rank ? `Sen: ${me.rank}. · ${nf.format(me.score)} puan` : 'Henüz puanın yok'}
            {board === 'season' ? ` · ${left(data.seasonEndsAt)}` : ''}
          </span>
        </div>
        <Board rows={rows} meId={meId} />
        {board === 'season' && data.lastSeasonTop.length > 0 ? (
          <p className="font-label-sm text-on-surface-variant">
            Geçen sezon: {data.lastSeasonTop.map((e) => `${['🥇', '🥈', '🥉'][e.rank - 1]} ${e.displayName}`).join('  ')}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Board({ rows, meId }: { rows: SeasonEntryDto[]; meId: string }) {
  if (!rows.length) return <p className="font-body-sm text-outline">Bu dönemde henüz puan yok.</p>;
  return (
    <ol className="divide-y divide-outline-variant/30 rounded-xl bg-surface-container-low">
      {rows.map((r) => (
        <li key={r.userId} className={cn('flex items-center gap-2 px-space-sm py-1.5', r.userId === meId && 'bg-primary-container/10')}>
          <span className="w-6 text-center font-label-md tabular-nums text-on-surface-variant">
            {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}
          </span>
          <Avatar imageUrl={r.avatarUrl} displayName={r.displayName} size="sm" />
          <span className="flex-1 truncate font-body-sm text-on-surface">{r.displayName}</span>
          <span className="font-label-md tabular-nums text-on-surface">{nf.format(r.score)}</span>
        </li>
      ))}
    </ol>
  );
}
