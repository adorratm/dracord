'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TOURNAMENT_AUTO_RESULT_GAMES,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_GAMES,
  TOURNAMENT_GAME_LABEL,
  TOURNAMENT_LIMITS,
  roundRobinStandings,
  tournamentMatchPlayers,
  type TournamentDto,
  type TournamentFormat,
  type TournamentGame,
  type TournamentMatch,
} from '@dracord/types';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';

export type TournamentsClient = {
  listTournaments(guildId: string): Promise<TournamentDto[]>;
  createTournament(
    guildId: string,
    input: {
      name: string;
      description?: string | null;
      game: TournamentGame;
      format?: TournamentFormat;
      externalGameName?: string | null;
      maxPlayers?: number;
    },
  ): Promise<TournamentDto>;
  tournamentAction(id: string, action: 'join' | 'leave' | 'start' | 'cancel'): Promise<TournamentDto>;
  kickFromTournament(id: string, userId: string): Promise<TournamentDto>;
  reportTournamentMatch(id: string, matchId: string, winnerId: string, force?: boolean): Promise<TournamentDto>;
  onTournamentUpdate(handler: (t: TournamentDto) => void): () => void;
};

const STATUS_TR: Record<TournamentDto['status'], string> = {
  registration: 'Kayıt açık',
  running: 'Devam ediyor',
  finished: 'Bitti',
  cancelled: 'İptal',
};

const gameLabel = (t: Pick<TournamentDto, 'game' | 'externalGameName'>) =>
  t.game === 'external' ? t.externalGameName || 'Harici oyun' : TOURNAMENT_GAME_LABEL[t.game];

const roundName = (r: number, rounds: number, format: TournamentFormat = 'single', m?: TournamentMatch) =>
  format === 'double' && m?.bracket
    ? m.bracket === 'GF1'
      ? 'Büyük final'
      : m.bracket === 'GF2'
        ? 'Rövanş'
        : m.bracket === 'W'
          ? `Üst kol ${m.round}`
          : `Alt kol ${/^l(\d+)/.exec(m.id)?.[1] ?? ''}`
    : format === 'round_robin'
    ? `${r}. tur`
    : r === rounds
      ? 'Final'
      : r === rounds - 1
        ? 'Yarı final'
        : r === rounds - 2 && format === 'single'
          ? 'Çeyrek final'
          : `${r}. tur`;

/** Oyun → seçilebilir biçimler. 2 kişilik oyunlarda masa yok; okey yalnız masa. */
export function tournamentFormatsFor(game: TournamentGame): TournamentFormat[] {
  if (game === 'okey') return ['table4'];
  if (game === 'tavla' || game === 'billiards') return ['single', 'double', 'round_robin'];
  return ['single', 'double', 'round_robin', 'table4'];
}

/**
 * Turnuvalar (C2) — web + desktop. Düzenleyici: MANAGE_GUILD (API denetler).
 */
export function TournamentsPanel({
  client,
  guildId,
  meId,
  canManage,
  initialId,
  onPlayGame,
}: {
  client: TournamentsClient;
  guildId: string;
  meId: string;
  canManage: boolean;
  initialId?: string | null;
  /** oyunun odası varsa oraya götür; yoksa undefined döndür (düğme gizlenir) */
  onPlayGame?: (game: TournamentGame) => (() => void) | undefined;
}) {
  const [list, setList] = useState<TournamentDto[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialId ?? null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void client
      .listTournaments(guildId)
      .then((l) => alive && setList(l))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Yüklenemedi'));
    const off = client.onTournamentUpdate((t) => {
      if (t.guildId !== guildId) return;
      setList((prev) => {
        const cur = prev ?? [];
        return cur.some((x) => x.id === t.id) ? cur.map((x) => (x.id === t.id ? t : x)) : [t, ...cur];
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, [client, guildId]);

  const upsert = useCallback((t: TournamentDto) => {
    setList((prev) => {
      const cur = prev ?? [];
      return cur.some((x) => x.id === t.id) ? cur.map((x) => (x.id === t.id ? t : x)) : [t, ...cur];
    });
  }, []);

  const open = list?.find((t) => t.id === openId) ?? null;

  if (open) {
    return <TournamentDetail t={open} client={client} meId={meId} canManage={canManage || open.creatorId === meId} onBack={() => setOpenId(null)} onChange={upsert} onPlay={onPlayGame?.(open.game)} />;
  }

  return (
    <div className="space-y-space-md">
      <div className="flex items-center justify-between gap-2">
        <p className="font-body-sm text-on-surface-variant">Tek eleme, 1v1. Sonucu iki oyuncu bildirir; anlaşmazlıkta düzenleyici karar verir.</p>
        {canManage && !creating ? (
          <button type="button" onClick={() => setCreating(true)} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 font-label-md text-on-primary">
            Yeni turnuva
          </button>
        ) : null}
      </div>
      {creating ? (
        <CreateForm
          onCancel={() => setCreating(false)}
          onCreate={async (input) => {
            const t = await client.createTournament(guildId, input);
            upsert(t);
            setCreating(false);
            setOpenId(t.id);
          }}
        />
      ) : null}
      {err ? <p className="font-body-sm text-error">{err}</p> : null}
      {list === null ? <p className="font-body-sm text-outline">Yükleniyor…</p> : null}
      {list && list.length === 0 && !creating ? <p className="font-body-sm text-outline">Henüz turnuva yok.</p> : null}
      <ul className="space-y-2">
        {(list ?? []).map((t) => {
          const champ = t.winnerId ? t.participants.find((p) => p.userId === t.winnerId) : null;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOpenId(t.id)}
                className="w-full rounded-xl bg-surface-container-low px-space-md py-space-sm text-left hover:bg-surface-container-high"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary-container" aria-hidden>
                    emoji_events
                  </span>
                  <span className="flex-1 truncate font-label-md text-on-surface">{t.name}</span>
                  <span className={cn('font-label-sm', t.status === 'running' ? 'text-primary' : 'text-outline')}>{STATUS_TR[t.status]}</span>
                </div>
                <div className="mt-0.5 font-label-sm text-on-surface-variant">
                  {gameLabel(t)} · {t.participants.length}/{t.maxPlayers} oyuncu
                  {champ ? ` · 🏆 ${champ.displayName}` : ''}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CreateForm({
  onCreate,
  onCancel,
}: {
  onCreate: (i: {
    name: string;
    description: string | null;
    game: TournamentGame;
    format: TournamentFormat;
    externalGameName: string | null;
    maxPlayers: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [game, setGame] = useState<TournamentGame>('tavla');
  const [ext, setExt] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('single');
  const [max, setMax] = useState(16);
  const formats = tournamentFormatsFor(game);
  const fmt = formats.includes(format) ? format : formats[0]!;
  const maxOptions = fmt === 'round_robin' ? [4, 6, 8, 10, TOURNAMENT_LIMITS.roundRobinMax] : [4, 8, 16, 32, 64];
  const maxVal = maxOptions.includes(max) ? max : maxOptions[maxOptions.length - 1]!;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const field = 'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';
  return (
    <form
      className="space-y-2 rounded-xl border border-outline-variant/40 p-space-md"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        void onCreate({ name, description: desc.trim() || null, game, format: fmt, externalGameName: game === 'external' ? ext : null, maxPlayers: maxVal })
          .catch((x) => setErr(x instanceof Error ? x.message : 'Oluşturulamadı'))
          .finally(() => setBusy(false));
      }}
    >
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={TOURNAMENT_LIMITS.nameMax} placeholder="Turnuva adı" required />
      <div className="flex flex-wrap gap-2">
        <select className={cn(field, 'w-auto')} value={game} onChange={(e) => setGame(e.target.value as TournamentGame)} aria-label="Oyun">
          {TOURNAMENT_GAMES.map((g) => (
            <option key={g} value={g}>
              {TOURNAMENT_GAME_LABEL[g]}
            </option>
          ))}
        </select>
        <select className={cn(field, 'w-auto')} value={fmt} onChange={(e) => setFormat(e.target.value as TournamentFormat)} aria-label="Biçim">
          {formats.map((f) => (
            <option key={f} value={f}>
              {TOURNAMENT_FORMAT_LABEL[f]}
            </option>
          ))}
        </select>
        {game === 'external' ? (
          <input className={cn(field, 'flex-1 min-w-[10rem]')} value={ext} onChange={(e) => setExt(e.target.value)} maxLength={40} placeholder="Oyun adı (ör. COOMBIE, CS2)" required />
        ) : null}
        <label className="flex items-center gap-2 font-label-sm text-on-surface-variant">
          En fazla
          <select className={cn(field, 'w-auto')} value={maxVal} onChange={(e) => setMax(Number(e.target.value))}>
            {maxOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          oyuncu
        </label>
      </div>
      {TOURNAMENT_AUTO_RESULT_GAMES.includes(game) ? (
        <p className="font-body-sm text-on-surface-variant">
          Oyuncular sunucunun {TOURNAMENT_GAME_LABEL[game]} oyun kanalında birlikte oynayınca sonuç kendiliğinden işlenir.
        </p>
      ) : null}
      <textarea className={field} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={TOURNAMENT_LIMITS.descMax} placeholder="Kurallar, ödül, zaman (isteğe bağlı)" />
      {err ? <p className="font-body-sm text-error">{err}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 font-label-md text-on-primary disabled:opacity-50">
          {busy ? 'Oluşturuluyor…' : 'Oluştur'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-surface-container-high px-4 py-2 font-label-md text-on-surface">
          Vazgeç
        </button>
      </div>
    </form>
  );
}

function TournamentDetail({
  t,
  client,
  meId,
  canManage,
  onBack,
  onChange,
  onPlay,
}: {
  t: TournamentDto;
  client: TournamentsClient;
  meId: string;
  canManage: boolean;
  onBack: () => void;
  onChange: (t: TournamentDto) => void;
  onPlay?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const names = useMemo(() => new Map(t.participants.map((p) => [p.userId, p])), [t.participants]);
  const joined = t.participants.some((p) => p.userId === meId);
  const run = (fn: () => Promise<TournamentDto>) => {
    setBusy(true);
    setErr(null);
    void fn()
      .then(onChange)
      .catch((e) => setErr(e instanceof Error ? e.message : 'İşlem başarısız'))
      .finally(() => setBusy(false));
  };
  const myMatches =
    t.status === 'running'
      ? t.matches.filter((m) => (m.status === 'ready' || m.status === 'disputed') && tournamentMatchPlayers(m).includes(meId))
      : [];
  const format = t.format ?? 'single';
  const champ = t.winnerId ? names.get(t.winnerId) : null;

  return (
    <div className="space-y-space-md">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onBack} className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high" aria-label="Geri">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-headline-md text-on-surface">{t.name}</h3>
          <p className="font-label-sm text-on-surface-variant">
            {gameLabel(t)} · {TOURNAMENT_FORMAT_LABEL[format]} · {STATUS_TR[t.status]} · {t.participants.length}/{t.maxPlayers} oyuncu
          </p>
        </div>
      </div>
      {t.description ? <p className="whitespace-pre-wrap font-body-sm text-on-surface-variant">{t.description}</p> : null}
      {champ ? (
        <div className="flex items-center gap-2 rounded-xl bg-primary-container/15 px-space-md py-space-sm">
          <span className="text-2xl" aria-hidden>
            🏆
          </span>
          <Avatar imageUrl={champ.avatarUrl} displayName={champ.displayName} size="sm" />
          <span className="font-label-md text-on-surface">Şampiyon: {champ.displayName}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {t.status === 'registration' ? (
          joined ? (
            <button type="button" disabled={busy} onClick={() => run(() => client.tournamentAction(t.id, 'leave'))} className="rounded-lg bg-surface-container-high px-3 py-1.5 font-label-md text-on-surface disabled:opacity-50">
              Kaydımı sil
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || t.participants.length >= t.maxPlayers}
              onClick={() => run(() => client.tournamentAction(t.id, 'join'))}
              className="rounded-lg bg-primary px-3 py-1.5 font-label-md text-on-primary disabled:opacity-50"
            >
              {t.participants.length >= t.maxPlayers ? 'Dolu' : 'Katıl'}
            </button>
          )
        ) : null}
        {canManage && t.status === 'registration' ? (
          <button
            type="button"
            disabled={busy || t.participants.length < TOURNAMENT_LIMITS.minPlayers}
            onClick={() => run(() => client.tournamentAction(t.id, 'start'))}
            className="rounded-lg bg-primary px-3 py-1.5 font-label-md text-on-primary disabled:opacity-50"
            title={t.participants.length < TOURNAMENT_LIMITS.minPlayers ? `En az ${TOURNAMENT_LIMITS.minPlayers} oyuncu` : 'Eşleşmeler rastgele oluşturulur'}
          >
            Başlat
          </button>
        ) : null}
        {canManage && (t.status === 'registration' || t.status === 'running') ? (
          <button type="button" disabled={busy} onClick={() => run(() => client.tournamentAction(t.id, 'cancel'))} className="rounded-lg bg-surface-container-high px-3 py-1.5 font-label-md text-error disabled:opacity-50">
            İptal et
          </button>
        ) : null}
      </div>
      {err ? <p className="font-body-sm text-error">{err}</p> : null}

      {myMatches.map((m) => (
        <MyMatchCard
          key={m.id}
          m={m}
          meId={meId}
          names={names}
          busy={busy}
          label={roundName(m.round, t.rounds, format, m)}
          auto={TOURNAMENT_AUTO_RESULT_GAMES.includes(t.game) ? TOURNAMENT_GAME_LABEL[t.game] : null}
          onReport={(w) => run(() => client.reportTournamentMatch(t.id, m.id, w))}
          onPlay={t.status === 'running' ? onPlay : undefined}
        />
      ))}

      {t.status === 'registration' ? (
        <section>
          <h4 className="mb-2 font-label-md text-on-surface">Kayıtlılar</h4>
          {t.participants.length === 0 ? <p className="font-body-sm text-outline">Henüz kimse katılmadı.</p> : null}
          <ul className="flex flex-wrap gap-2">
            {t.participants.map((p) => (
              <li key={p.userId} className="flex items-center gap-1.5 rounded-lg bg-surface-container-high py-1 pl-1 pr-2">
                <Avatar imageUrl={p.avatarUrl} displayName={p.displayName} size="sm" />
                <span className="font-label-sm text-on-surface">{p.displayName}</span>
                {canManage && p.userId !== meId ? (
                  <button type="button" onClick={() => run(() => client.kickFromTournament(t.id, p.userId))} className="text-outline hover:text-error" aria-label={`${p.displayName} çıkar`}>
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : t.matches.length ? (
        <>
          {format === 'round_robin' ? <Standings t={t} names={names} /> : null}
          <Bracket t={t} names={names} canManage={canManage} busy={busy} onForce={(mid, w) => run(() => client.reportTournamentMatch(t.id, mid, w, true))} />
        </>
      ) : null}
    </div>
  );
}

function MyMatchCard({
  m,
  meId,
  names,
  busy,
  label,
  auto,
  onReport,
  onPlay,
}: {
  m: TournamentMatch;
  meId: string;
  names: Map<string, { displayName: string }>;
  busy: boolean;
  label: string;
  /** Sonucu oyundan alınan oyunun adı */
  auto: string | null;
  onReport: (winnerId: string) => void;
  /** oyun odasına git (sunucuda uygun oda varsa) */
  onPlay?: () => void;
}) {
  const players = tournamentMatchPlayers(m);
  const others = players.filter((p) => p !== meId);
  const mine = m.reports[meId];
  const nm = (id: string) => names.get(id)?.displayName ?? 'Oyuncu';
  const table = players.length > 2;
  return (
    <div className="rounded-xl border border-primary/40 bg-surface-container-low p-space-md">
      <p className="font-label-sm text-primary">
        {label} · {table ? 'senin masan' : 'senin maçın'}
      </p>
      <p className="font-body-md text-on-surface">
        {table ? 'Masadakiler' : 'Rakip'}: <strong>{others.map(nm).join(', ')}</strong>
      </p>
      {m.status === 'disputed' ? (
        <p className="mt-1 font-body-sm text-error">Bildirimler uyuşmadı — düzenleyici karar verecek. Yanlışlıkla bildirdiysen düzeltebilirsin.</p>
      ) : mine ? (
        <p className="mt-1 font-body-sm text-on-surface-variant">
          Bildirdin: {mine === meId ? 'ben kazandım' : `${nm(mine)} kazandı`} — {table ? 'masadan bir onay daha' : 'rakibin onayı'} bekleniyor.
        </p>
      ) : (
        <p className="mt-1 font-body-sm text-on-surface-variant">
          {auto
            ? `${auto} oyun kanalında birlikte oynayın — sonuç kendiliğinden işlenir. Oyun dışında oynadıysanız aşağıdan bildir.`
            : table
              ? 'Oynadıktan sonra masayı kimin kazandığını bildir; iki oyuncunun bildirimi uyuşunca kesinleşir.'
              : 'Oynadıktan sonra sonucu bildir.'}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {onPlay && m.status !== 'done' ? (
          <button type="button" onClick={onPlay} className="rounded-lg bg-[#50fa7b] px-3 py-1.5 font-label-md text-[#11131e]">
            ▶ Oyun odasına git
          </button>
        ) : null}
        <button type="button" disabled={busy || mine === meId} onClick={() => onReport(meId)} className="rounded-lg bg-primary px-3 py-1.5 font-label-md text-on-primary disabled:opacity-50">
          Ben kazandım
        </button>
        {others.map((o) => (
          <button
            key={o}
            type="button"
            disabled={busy || mine === o}
            onClick={() => onReport(o)}
            className="rounded-lg bg-surface-container-high px-3 py-1.5 font-label-md text-on-surface disabled:opacity-50"
          >
            {table ? `${nm(o)} kazandı` : 'Rakip kazandı'}
          </button>
        ))}
      </div>
    </div>
  );
}

function Standings({ t, names }: { t: TournamentDto; names: Map<string, { displayName: string }> }) {
  const rows = roundRobinStandings(t.matches, t.participants.map((p) => p.userId));
  const total = t.participants.length - 1;
  return (
    <section>
      <h4 className="mb-2 font-label-md text-on-surface">Puan durumu</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left font-label-sm text-outline">
            <th className="w-8 py-1">#</th>
            <th>Oyuncu</th>
            <th className="w-16 text-right">G</th>
            <th className="w-20 text-right">Oynanan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.userId} className="border-t border-outline-variant/30">
              <td className="py-1 text-outline">{i + 1}</td>
              <td className="truncate text-on-surface">{names.get(r.userId)?.displayName ?? 'Ayrılmış üye'}</td>
              <td className="text-right font-semibold text-on-surface">{r.wins}</td>
              <td className="text-right text-on-surface-variant">
                {r.played}/{total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Bracket({
  t,
  names,
  canManage,
  busy,
  onForce,
}: {
  t: TournamentDto;
  names: Map<string, { displayName: string }>;
  canManage: boolean;
  busy: boolean;
  onForce: (matchId: string, winnerId: string) => void;
}) {
  const rounds = Array.from({ length: t.rounds }, (_, i) => t.matches.filter((m) => m.round === i + 1).sort((a, b) => a.index - b.index));
  const format = t.format ?? 'single';
  const rows = (m: TournamentMatch): Array<string | null> => {
    if (!m.players) return [m.p1, m.p2];
    const out: Array<string | null> = [...m.players];
    while (out.length < (m.slots ?? 2)) out.push(null);
    return out;
  };
  const name = (id: string | null) => (id ? (names.get(id)?.displayName ?? 'Ayrılmış üye') : '—');
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-space-md">
        {rounds.map((ms, ri) => (
          <div key={ri} className="flex w-52 flex-col">
            <h4 className="mb-2 font-label-sm uppercase tracking-wider text-outline">{roundName(ri + 1, t.rounds, format, rounds[ri]?.[0])}</h4>
            <div className="flex flex-1 flex-col justify-around gap-2">
              {ms.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'rounded-lg border bg-surface-container-low text-sm',
                    m.status === 'disputed' ? 'border-error/60' : m.status === 'ready' ? 'border-primary/40' : 'border-outline-variant/40',
                  )}
                >
                  {rows(m).map((p, k, all) => (
                    <div
                      key={k}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1',
                        k < all.length - 1 && 'border-b border-outline-variant/30',
                        m.winnerId && p === m.winnerId ? 'font-semibold text-on-surface' : m.winnerId ? 'text-outline line-through' : 'text-on-surface-variant',
                      )}
                    >
                      <span className="flex-1 truncate">{m.bye && !p ? 'rakipsiz' : name(p)}</span>
                      {m.winnerId && p === m.winnerId ? <span aria-label="kazanan">✓</span> : null}
                      {canManage && p && (m.status === 'ready' || m.status === 'disputed') ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onForce(m.id, p)}
                          className="rounded px-1 font-label-sm text-primary hover:bg-surface-container-high disabled:opacity-50"
                          title="Düzenleyici kararı: bu oyuncu kazandı"
                        >
                          kazandı
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {m.status === 'disputed' ? <div className="px-2 pb-1 font-label-sm text-error">anlaşmazlık</div> : null}
                  {m.source === 'game' ? <div className="px-2 pb-1 font-label-sm text-outline">sonuç oyundan</div> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
