'use client';

import { useEffect, useState } from 'react';
import type { CreateLfgInput, LfgListingDto } from '@dracord/types';
import { cn } from '../lib/cn';

export interface LfgClient {
  listLfg(guildId: string): Promise<LfgListingDto[]>;
  createLfg(guildId: string, input: CreateLfgInput): Promise<LfgListingDto>;
  joinLfg(id: string): Promise<LfgListingDto>;
  leaveLfg(id: string): Promise<LfgListingDto>;
  closeLfg(id: string): Promise<LfgListingDto>;
  onLfgUpdate(handler: (l: LfgListingDto) => void): () => void;
}

interface Props {
  client: LfgClient;
  guildId: string;
  meId: string;
  canModerate: boolean;
  voiceChannels: Array<{ id: string; name: string }>;
  memberName: (userId: string) => string;
  /** the game running on this computer (desktop presence), to prefill a new listing */
  currentGame?: string | null;
  /** joined a listing with a voice room: go there */
  onJoinVoice?: (channelId: string) => void;
}

const field =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';

function minutesLeft(iso: string): string {
  const m = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60} dk` : `${m} dk`;
}

/** C5 — "Takım arıyorum": open listings in this server, live; one click to join */
export function LfgBoard({ client, guildId, meId, canModerate, voiceChannels, memberName, currentGame, onJoinVoice }: Props) {
  const [list, setList] = useState<LfgListingDto[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateLfgInput>({ game: currentGame ?? '', slots: 5, rank: '', note: '', voice: true, voiceChannelId: null, durationMin: 120 });
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let alive = true;
    void client
      .listLfg(guildId)
      .then((l) => alive && setList(l))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'İlanlar yüklenemedi'));
    const off = client.onLfgUpdate((l) => {
      if (l.guildId !== guildId) return;
      setList((prev) => {
        const rest = (prev ?? []).filter((x) => x.id !== l.id);
        return l.closed ? rest : [l, ...rest];
      });
    });
    // expired listings drop off without a server event
    const tick = setInterval(() => setList((prev) => prev?.filter((x) => Date.parse(x.expiresAt) > Date.now()) ?? prev), 30_000);
    return () => {
      alive = false;
      off();
      clearInterval(tick);
    };
  }, [client, guildId]);

  const act = async (id: string, fn: () => Promise<LfgListingDto>, after?: (l: LfgListingDto) => void) => {
    setBusyId(id);
    setError(null);
    try {
      const l = await fn();
      setList((prev) => {
        const rest = (prev ?? []).filter((x) => x.id !== l.id);
        return l.closed ? rest : [l, ...rest];
      });
      after?.(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusyId(null);
    }
  };

  const submit = async () => {
    setError(null);
    try {
      const l = await client.createLfg(guildId, {
        ...form,
        rank: form.rank?.trim() || null,
        note: form.note?.trim() || null,
        voiceChannelId: form.voice ? form.voiceChannelId || null : null,
      });
      setList((prev) => [l, ...(prev ?? []).filter((x) => x.id !== l.id && !(x.authorId === meId))]);
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İlan açılamadı');
    }
  };

  const shown = (list ?? []).filter((l) => !filter.trim() || l.game.toLocaleLowerCase('tr').includes(filter.trim().toLocaleLowerCase('tr')));
  const vcName = (id: string | null) => voiceChannels.find((c) => c.id === id)?.name;

  return (
    <div className="space-y-space-md">
      <div className="flex gap-2">
        <input className={field} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Oyuna göre ara…" aria-label="Oyuna göre ara" />
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="shrink-0 px-4 rounded-lg bg-primary-container text-on-primary-container font-label-md"
        >
          {creating ? 'Vazgeç' : 'İlan aç'}
        </button>
      </div>

      {creating ? (
        <div className="rounded-xl bg-surface-container-low p-3 space-y-2">
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <input className={field} value={form.game} maxLength={60} onChange={(e) => setForm({ ...form, game: e.target.value })} placeholder="Oyun (ör. Valorant)" aria-label="Oyun" />
            <label className="flex items-center gap-1 font-body-sm text-on-surface-variant">
              <input
                type="number"
                min={2}
                max={16}
                className={cn(field, 'px-2')}
                value={form.slots}
                onChange={(e) => setForm({ ...form, slots: Number(e.target.value) })}
                aria-label="Kişi sayısı"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={field} value={form.rank ?? ''} maxLength={40} onChange={(e) => setForm({ ...form, rank: e.target.value })} placeholder="Rank (isteğe bağlı)" aria-label="Rank" />
            <select className={field} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} aria-label="Süre">
              <option value={30}>30 dk açık</option>
              <option value={60}>1 saat açık</option>
              <option value={120}>2 saat açık</option>
              <option value={240}>4 saat açık</option>
            </select>
          </div>
          <input className={field} value={form.note ?? ''} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Not (ör. rahat oyun, mikrofon şart)" aria-label="Not" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 font-body-sm text-on-surface">
              <input type="checkbox" className="accent-primary-container" checked={!!form.voice} onChange={(e) => setForm({ ...form, voice: e.target.checked })} />
              Sesli
            </label>
            {form.voice ? (
              <select
                className={cn(field, 'w-auto min-w-[10rem]')}
                value={form.voiceChannelId ?? ''}
                onChange={(e) => setForm({ ...form, voiceChannelId: e.target.value || null })}
                aria-label="Ses kanalı"
              >
                <option value="">Ses kanalı seçme</option>
                {voiceChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    🔊 {c.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              disabled={!form.game.trim()}
              onClick={() => void submit()}
              className="ml-auto px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50"
            >
              Yayınla
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="font-body-sm text-error">{error}</p> : null}
      {list === null ? <p className="font-body-sm text-outline">Yükleniyor…</p> : null}
      {list !== null && shown.length === 0 ? (
        <p className="font-body-sm text-on-surface-variant">Şu an açık ilan yok. İlk ilanı sen aç — oyununu ve kaç kişi aradığını yaz.</p>
      ) : null}

      <ul className="space-y-2">
        {shown.map((l) => {
          const mine = l.authorId === meId;
          const inIt = l.memberIds.includes(meId);
          const full = l.memberIds.length >= l.slots;
          return (
            <li key={l.id} className="rounded-xl bg-surface-container-low p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-headline-md text-on-surface truncate">
                    {l.game}
                    {l.rank ? <span className="ml-2 font-label-sm text-dracula-orange">{l.rank}</span> : null}
                  </p>
                  <p className="font-body-sm text-on-surface-variant">
                    {memberName(l.authorId)} · {l.memberIds.length}/{l.slots} kişi
                    {l.voice ? ` · 🎙 ${vcName(l.voiceChannelId) ?? 'sesli'}` : ''} · {minutesLeft(l.expiresAt)} kaldı
                  </p>
                  {l.note ? <p className="font-body-sm text-on-surface mt-1 break-words">{l.note}</p> : null}
                  <div className="mt-2 flex gap-1" aria-label="Doluluk">
                    {Array.from({ length: l.slots }, (_, i) => (
                      <span
                        key={i}
                        title={l.memberIds[i] ? memberName(l.memberIds[i]!) : 'Boş'}
                        className={cn('h-2 flex-1 max-w-6 rounded-full', l.memberIds[i] ? 'bg-dracula-green' : 'bg-surface-container-high')}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {!inIt ? (
                    <button
                      type="button"
                      disabled={full || busyId === l.id}
                      onClick={() =>
                        void act(l.id, () => client.joinLfg(l.id), (r) => {
                          if (r.voiceChannelId) onJoinVoice?.(r.voiceChannelId);
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
                    >
                      {full ? 'Dolu' : 'Katıl'}
                    </button>
                  ) : (
                    <>
                      {l.voiceChannelId ? (
                        <button type="button" onClick={() => onJoinVoice?.(l.voiceChannelId!)} className="px-3 py-1.5 rounded-lg bg-dracula-green/20 text-on-surface font-label-sm">
                          Sese gir
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === l.id}
                        onClick={() => void act(l.id, () => client.leaveLfg(l.id))}
                        className="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-sm"
                      >
                        {mine ? 'Kapat' : 'Ayrıl'}
                      </button>
                    </>
                  )}
                  {!mine && canModerate ? (
                    <button type="button" onClick={() => void act(l.id, () => client.closeLfg(l.id))} className="px-3 py-1 rounded-lg text-error font-label-sm">
                      Kaldır
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
