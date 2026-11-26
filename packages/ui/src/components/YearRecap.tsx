'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { YearRecapDto } from '@dracord/types';
import { RECAP_MONTHS, recapHours, renderRecapCard, shareRecapCard } from '../lib/recap-card';
import { Avatar } from './Avatar';

export type YearRecapClient = {
  getYearRecap(year?: number): Promise<YearRecapDto>;
};

export interface YearRecapProps {
  client: YearRecapClient;
  /** kartta görünen ad */
  name: string;
  year?: number;
  onClose: () => void;
}

const nf = new Intl.NumberFormat('tr-TR');
const GRADS = [
  'linear-gradient(160deg,#1b0f3a,#4a1d7a 55%,#d9467a)',
  'linear-gradient(160deg,#04223a,#0b6a8a 60%,#3ad0b0)',
  'linear-gradient(160deg,#2a0f0f,#8a2a1a 55%,#f0a030)',
  'linear-gradient(160deg,#0f1a2a,#2a3a8a 55%,#9a6aff)',
  'linear-gradient(160deg,#102010,#2a6a2a 55%,#c0e040)',
  'linear-gradient(160deg,#20101a,#7a1a4a 55%,#ff7a9a)',
];

interface Slide {
  key: string;
  render: () => React.ReactNode;
}

/** Yılın özeti: hikâye gibi kayan kartlar + paylaşılabilir görsel (web + desktop). */
export function YearRecap({ client, name, year, onClose }: YearRecapProps) {
  const [data, setData] = useState<YearRecapDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    client
      .getYearRecap(year)
      .then((d) => alive && setData(d))
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : 'Özet yüklenemedi'));
    return () => {
      alive = false;
    };
  }, [client, year]);

  const slides = useMemo<Slide[]>(() => {
    if (!data) return [];
    const r = data;
    const out: Slide[] = [];
    const big = 'font-black tracking-tight text-white';
    out.push({
      key: 'intro',
      render: () => (
        <>
          <p className="text-lg text-white/80">Merhaba {name}</p>
          <h2 className={`${big} text-5xl leading-tight`}>{r.year} senin için nasıl geçti?</h2>
          <p className="text-white/70">Dracord'daki yılına birlikte bakalım.</p>
        </>
      ),
    });
    if (r.messages > 0) {
      const max = Math.max(1, ...r.byMonth);
      out.push({
        key: 'messages',
        render: () => (
          <>
            <p className="text-white/80">Bu yıl tam</p>
            <h2 className={`${big} text-7xl`}>{nf.format(r.messages)}</h2>
            <p className="text-xl text-white">mesaj yazdın.</p>
            <div className="mt-6 flex h-28 items-end gap-1">
              {r.byMonth.map((m, k) => (
                <div key={k} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-white/80" style={{ height: `${Math.max(3, (m / max) * 100)}%` }} />
                  <span className="text-[10px] text-white/60">{RECAP_MONTHS[k]!.slice(0, 3)}</span>
                </div>
              ))}
            </div>
            {r.busiestDay && (
              <p className="mt-3 text-sm text-white/75">
                En coşkulu günün {new Date(`${r.busiestDay.day}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}: {nf.format(r.busiestDay.messages)} mesaj.
              </p>
            )}
          </>
        ),
      });
    }
    out.push({
      key: 'days',
      render: () => (
        <>
          <p className="text-white/80">{nf.format(r.activeDays)} gün buradaydın</p>
          <h2 className={`${big} text-6xl`}>🔥 {nf.format(r.longestStreak)} gün</h2>
          <p className="text-xl text-white">en uzun serin.</p>
          {r.busiestHour !== null && (
            <p className="mt-4 text-white/75">
              En çok saat {String(r.busiestHour).padStart(2, '0')}:00 civarında yazdın
              {r.busiestHour >= 23 || r.busiestHour < 5 ? ' — gece kuşu!' : r.busiestHour < 10 ? ' — erkenci!' : '.'}
            </p>
          )}
        </>
      ),
    });
    if (r.voiceMinutes > 0)
      out.push({
        key: 'voice',
        render: () => (
          <>
            <p className="text-white/80">Ses kanallarında</p>
            <h2 className={`${big} text-7xl`}>🎙️ {recapHours(r.voiceMinutes)}</h2>
            <p className="text-xl text-white">geçirdin.</p>
            <p className="mt-4 text-white/70">Bu, yaklaşık {nf.format(Math.max(1, Math.round(r.voiceMinutes / 110)))} film izlemek demek.</p>
          </>
        ),
      });
    if (r.topFriends.length)
      out.push({
        key: 'friends',
        render: () => (
          <>
            <p className="text-white/80">En çok yazıştıkların</p>
            <ol className="mt-4 space-y-3">
              {r.topFriends.map((f, k) => (
                <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                  <span className="w-6 text-2xl font-black text-white">{k + 1}</span>
                  <Avatar imageUrl={f.avatarUrl ?? undefined} displayName={f.displayName} size="md" statusRing={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white">{f.displayName}</p>
                    <p className="text-sm text-white/70">{nf.format(f.messages)} mesaj</p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        ),
      });
    if (r.topGuilds.length)
      out.push({
        key: 'places',
        render: () => (
          <>
            <p className="text-white/80">Evin gibi olan sunucu</p>
            <h2 className={`${big} text-4xl`}>{r.topGuilds[0]!.name}</h2>
            <p className="text-white/75">{nf.format(r.topGuilds[0]!.messages)} mesajla.</p>
            {r.topChannels.length > 0 && (
              <ul className="mt-5 space-y-2">
                {r.topChannels.map((c) => (
                  <li key={c.id} className="flex justify-between rounded-xl bg-white/10 px-3 py-2 text-white">
                    <span className="truncate">#{c.name} <span className="text-white/60">· {c.guildName}</span></span>
                    <span className="font-bold">{nf.format(c.messages)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ),
      });
    if (r.topEmojis.length || r.games.played)
      out.push({
        key: 'fun',
        render: () => (
          <>
            {r.topEmojis.length > 0 && (
              <>
                <p className="text-white/80">Favori tepkilerin</p>
                <p className="mt-2 text-6xl">{r.topEmojis.map((e) => e.emoji).join(' ')}</p>
                <p className="mt-1 text-white/70">{nf.format(r.reactionsGiven)} tepki bıraktın.</p>
              </>
            )}
            {r.games.played > 0 && (
              <div className="mt-8">
                <p className="text-white/80">Oyun masasında</p>
                <h2 className={`${big} text-5xl`}>🎮 {nf.format(r.games.played)} oyun</h2>
                <p className="text-white">
                  {nf.format(r.games.won)} galibiyet{r.tournamentsWon ? ` · 🏆 ${r.tournamentsWon} turnuva` : ''}
                </p>
              </div>
            )}
          </>
        ),
      });
    out.push({
      key: 'persona',
      render: () => (
        <>
          <p className="text-white/80">{r.year} yılında sen…</p>
          <p className="mt-2 text-8xl">{r.persona.emoji}</p>
          <h2 className={`${big} text-5xl`}>{r.persona.title}</h2>
          <p className="mt-2 text-lg text-white/85">{r.persona.desc}</p>
        </>
      ),
    });
    return out;
  }, [data, name]);

  const next = useCallback(() => setI((k) => Math.min(slides.length - 1, k + 1)), [slides.length]);
  const prev = useCallback(() => setI((k) => Math.max(0, k - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  const share = async () => {
    if (!data) return;
    setShareMsg('Görsel hazırlanıyor…');
    const blob = await renderRecapCard(data, name);
    if (!blob) return setShareMsg('Görsel oluşturulamadı');
    const how = await shareRecapCard(blob, data.year);
    setShareMsg(how === 'shared' ? 'Paylaşıldı' : 'Görsel indirildi');
  };

  const last = i === slides.length - 1;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Yıl özeti">
      <div className="relative flex h-[min(760px,92vh)] w-[min(430px,96vw)] flex-col overflow-hidden rounded-3xl shadow-2xl" style={{ background: GRADS[i % GRADS.length] }}>
        <div className="flex gap-1 p-3">
          {slides.map((s, k) => (
            <div key={s.key} className="h-1 flex-1 overflow-hidden rounded bg-white/25">
              <div className="h-full bg-white transition-all" style={{ width: k <= i ? '100%' : '0%' }} />
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose} className="absolute right-3 top-6 rounded-full bg-black/30 px-3 py-1 text-white" aria-label="Kapat">
          ✕
        </button>
        <div className="flex flex-1 flex-col justify-center gap-2 px-7 pb-4">
          {err && <p className="text-white">{err}</p>}
          {!err && !data && <p className="animate-pulse text-white/80">Yılın hesaplanıyor…</p>}
          {slides[i]?.render()}
        </div>
        {data && (
          <div className="flex items-center gap-2 p-4">
            <button type="button" onClick={prev} disabled={i === 0} className="rounded-full bg-white/15 px-4 py-2 text-white disabled:opacity-30">
              ‹
            </button>
            {last ? (
              <button type="button" onClick={() => void share()} className="flex-1 rounded-full bg-white px-4 py-2 font-bold text-black">
                Özetimi paylaş
              </button>
            ) : (
              <button type="button" onClick={next} className="flex-1 rounded-full bg-white/90 px-4 py-2 font-bold text-black">
                Devam
              </button>
            )}
          </div>
        )}
        {shareMsg && <p className="pb-3 text-center text-sm text-white/80">{shareMsg}</p>}
      </div>
    </div>
  );
}

/** Aralık–15 Ocak arası özet zamanı (geçen / bu yıl) */
export function recapSeasonYear(now = new Date()): number | null {
  const m = now.getMonth();
  if (m === 11) return now.getFullYear();
  if (m === 0 && now.getDate() <= 15) return now.getFullYear() - 1;
  return null;
}
