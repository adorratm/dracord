'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GameAppDto, GameAppInput, GamePlatform } from '@dracord/types';
import { useAuth } from '@/components/AuthProvider';

const STATUS: Record<GameAppDto['status'], { label: string; cls: string }> = {
  draft: { label: 'Taslak', cls: 'bg-surface-container-highest text-on-surface-variant' },
  in_review: { label: 'İncelemede', cls: 'bg-dracula-yellow/20 text-dracula-yellow' },
  approved: { label: 'Yayında', cls: 'bg-dracula-green/20 text-dracula-green' },
  rejected: { label: 'Reddedildi', cls: 'bg-error-container text-on-error-container' },
  suspended: { label: 'Askıda', cls: 'bg-error-container text-on-error-container' },
};
const PLATFORMS: Array<{ id: GamePlatform; label: string }> = [
  { id: 'web', label: 'Web' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'mobile', label: 'Mobil' },
];
const DOCS = 'https://dracord.mintlify.site/games';

function blank(): GameAppInput {
  return {
    name: '',
    shortDescription: '',
    description: '',
    entryUrl: 'http://localhost:5173',
    iconUrl: '',
    coverUrl: '',
    minPlayers: 1,
    maxPlayers: 8,
    orientation: 'any',
    platforms: ['web', 'desktop'],
  };
}

const input =
  'h-9 w-full rounded-lg bg-surface-container-highest px-2 font-body-md text-on-surface outline-none';

/** Ayarlar → Gelişmiş → Oyunlarım: oluştur, test et, incelemeye gönder */
export function DeveloperGames() {
  const { client } = useAuth();
  const [games, setGames] = useState<GameAppDto[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; form: GameAppInput } | null>(null);
  const [secret, setSecret] = useState<{ gameId: string; value: string } | null>(null);
  const [testers, setTesters] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGames(await client.listMyGames());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Oyunlar yüklenemedi');
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      if (!editing) return;
      const f = { ...editing.form, iconUrl: editing.form.iconUrl || null, coverUrl: editing.form.coverUrl || null };
      if (editing.id) await client.updateGame(editing.id, f);
      else {
        const r = await client.createGame(f);
        setSecret({ gameId: r.game.id, value: r.secret });
      }
      setEditing(null);
    });

  const set = <K extends keyof GameAppInput>(k: K, v: GameAppInput[K]) =>
    setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  return (
    <div className="px-space-md py-space-md flex flex-col gap-space-md">
      <p className="font-body-sm text-on-surface-variant">
        Dracord ses kanallarında oynanan oyunlar geliştir. Taslak oyununu kendin ve eklediğin testçiler
        sunucularda hemen test edebilir; herkese açılması için <strong>incelemeye gönder</strong> — yayın
        kararını Dracord ekibi verir.{' '}
        <a href={DOCS} target="_blank" rel="noreferrer" className="text-primary-container hover:underline">
          Geliştirici belgeleri
        </a>
      </p>

      {secret && (
        <div className="rounded-xl border border-dracula-orange/50 bg-dracula-orange/10 p-3 flex flex-col gap-1">
          <p className="font-label-md text-on-surface">Oyun gizli anahtarı — yalnız şimdi gösterilir</p>
          <code className="font-mono text-[12px] break-all select-all text-on-surface">{secret.value}</code>
          <p className="font-body-sm text-on-surface-variant">
            Yalnız oyun <strong>sunucunda</strong> sakla (<code>DRACORD_GAME_SECRET</code>). İstemci koduna koyma.
          </p>
          <button type="button" className="self-start font-label-sm text-primary-container" onClick={() => setSecret(null)}>
            Kaydettim, kapat
          </button>
        </div>
      )}

      {error && <p className="font-body-sm text-error">{error}</p>}

      {editing ? (
        <div className="rounded-xl border border-surface-container-highest bg-surface-container-low p-space-md flex flex-col gap-2">
          <h4 className="font-headline-md text-on-surface">{editing.id ? 'Oyunu düzenle' : 'Yeni oyun'}</h4>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-on-surface-variant">Ad</span>
            <input className={input} maxLength={40} value={editing.form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-on-surface-variant">Kısa açıklama</span>
            <input className={input} maxLength={120} value={editing.form.shortDescription ?? ''} onChange={(e) => set('shortDescription', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-on-surface-variant">Açıklama</span>
            <textarea
              className="min-h-20 w-full rounded-lg bg-surface-container-highest px-2 py-1.5 font-body-md text-on-surface outline-none"
              maxLength={4000}
              value={editing.form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-on-surface-variant">Oyun adresi (https; test için http://localhost)</span>
            <input className={input} value={editing.form.entryUrl ?? ''} onChange={(e) => set('entryUrl', e.target.value)} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface-variant">Simge URL (kare, 256px)</span>
              <input className={input} value={editing.form.iconUrl ?? ''} onChange={(e) => set('iconUrl', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface-variant">Kapak URL (16:9)</span>
              <input className={input} value={editing.form.coverUrl ?? ''} onChange={(e) => set('coverUrl', e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface-variant">En az oyuncu</span>
              <input type="number" min={1} max={50} className={input} value={editing.form.minPlayers ?? 1} onChange={(e) => set('minPlayers', Number(e.target.value))} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface-variant">En çok oyuncu</span>
              <input type="number" min={1} max={100} className={input} value={editing.form.maxPlayers ?? 8} onChange={(e) => set('maxPlayers', Number(e.target.value))} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface-variant">Yön</span>
              <select className={input} value={editing.form.orientation ?? 'any'} onChange={(e) => set('orientation', e.target.value as GameAppInput['orientation'])}>
                <option value="any">Serbest</option>
                <option value="landscape">Yatay</option>
                <option value="portrait">Dikey</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 font-body-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={(editing.form.platforms ?? []).includes(p.id)}
                  onChange={(e) => {
                    const cur = editing.form.platforms ?? [];
                    set('platforms', e.target.checked ? [...cur, p.id] : cur.filter((x) => x !== p.id));
                  }}
                />
                {p.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="h-9 px-3 rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container" onClick={() => setEditing(null)}>
              Vazgeç
            </button>
            <button type="button" disabled={busy} className="h-9 px-4 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-60" onClick={() => void save()}>
              {editing.id ? 'Kaydet' : 'Oluştur'}
            </button>
          </div>
          {editing.id && games.find((g) => g.id === editing.id)?.status === 'approved' && (
            <p className="font-body-sm text-dracula-yellow">
              Yayındaki oyunun adı veya adresi değişirse yeniden incelemeye düşer.
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing({ id: null, form: blank() })}
          className="self-start h-9 px-4 rounded-lg bg-primary-container text-on-primary-container font-label-md"
        >
          + Yeni oyun
        </button>
      )}

      <ul className="flex flex-col gap-2">
        {games.map((g) => (
          <li key={g.id} className="rounded-xl border border-surface-container-highest bg-surface-container-low p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {g.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.iconUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <span className="h-10 w-10 rounded-lg bg-surface-container-highest flex items-center justify-center material-symbols-outlined">sports_esports</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-label-md text-on-surface truncate">
                  {g.name} <span className="font-label-sm text-outline">/{g.slug}</span>
                </p>
                <p className="font-body-sm text-outline truncate">{g.entryUrl}</p>
              </div>
              <span className={`rounded-md px-2 py-0.5 font-label-sm ${STATUS[g.status].cls}`}>{STATUS[g.status].label}</span>
            </div>
            {g.reviewNote && (g.status === 'rejected' || g.status === 'suspended') && (
              <p className="font-body-sm text-error">İnceleme notu: {g.reviewNote}</p>
            )}
            <p className="font-label-sm text-outline">
              Kimlik: <code className="select-all">{g.id}</code> · Anahtar …{g.secretLast4 ?? '????'}
            </p>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface-variant">Testçiler (kullanıcı adları, virgülle)</span>
              <div className="flex gap-2">
                <input
                  className={input}
                  placeholder="ahmet, ayse"
                  value={testers[g.id] ?? ''}
                  onChange={(e) => setTesters((t) => ({ ...t, [g.id]: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={busy}
                  className="h-9 px-3 rounded-lg bg-surface-container-high font-label-sm text-on-surface"
                  onClick={() => void run(() => client.setGameTesters(g.id, (testers[g.id] ?? '').split(',').map((x) => x.trim())))}
                >
                  Kaydet
                </button>
              </div>
              <span className="font-label-sm text-outline">{g.testerUserIds?.length ?? 0} testçi kayıtlı</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="h-8 px-3 rounded-lg bg-surface-container-high font-label-sm text-on-surface" onClick={() => setEditing({ id: g.id, form: { ...g } })}>
                Düzenle
              </button>
              {(g.status === 'draft' || g.status === 'rejected') && (
                <button type="button" disabled={busy} className="h-8 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-sm" onClick={() => void run(() => client.submitGame(g.id))}>
                  İncelemeye gönder
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                className="h-8 px-3 rounded-lg bg-surface-container-high font-label-sm text-on-surface"
                onClick={() =>
                  window.confirm('Eski anahtar hemen geçersiz olur. Devam?') &&
                  void run(async () => {
                    const r = await client.rotateGameSecret(g.id);
                    setSecret({ gameId: g.id, value: r.secret });
                  })
                }
              >
                Anahtarı yenile
              </button>
              <button
                type="button"
                disabled={busy}
                className="h-8 px-3 rounded-lg font-label-sm text-error hover:bg-error-container/30"
                onClick={() => window.confirm(`“${g.name}” silinsin mi?`) && void run(() => client.deleteGame(g.id))}
              >
                Sil
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="font-body-sm text-outline">
        Test: oyunu bir ses kanalında başlat (kontrol çubuğu → 🎮). Taslak oyunlar yalnız sana ve testçilere görünür.
      </p>
    </div>
  );
}
