'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GameAppDto, GameAppStatus } from '@dracord/types';
import { AdminShell } from '@/components/AdminShell';
import { getApiBaseUrl } from '@/lib/client';
import { getAccessToken } from '@/lib/storage';

const TABS: Array<{ id: GameAppStatus | 'all'; label: string }> = [
  { id: 'in_review', label: 'İnceleme bekleyen' },
  { id: 'approved', label: 'Yayında' },
  { id: 'rejected', label: 'Reddedilen' },
  { id: 'suspended', label: 'Askıda' },
  { id: 'draft', label: 'Taslak' },
  { id: 'all', label: 'Tümü' },
];

const CHECKLIST = [
  'Oyun adresi https ve açılıyor; Dracord dışına izinsiz yönlendirmiyor',
  'Kimlik: token sunucuda /v1/games/verify ile doğrulanıyor (istemciye güvenmiyor)',
  'Ödeme / kumar / yetişkin içerik yok; kullanıcı verisi toplamıyorsa açıkça yazıyor',
  'Seçilen platformlarda (web/desktop/mobil) oynanabiliyor; mobilde dokunmatik kontrol var',
  'Simge, ad ve açıklama yanıltıcı değil; telifli marka/karakter yok',
  'Performans: 60 sn içinde açılıyor, sekme kapanınca oturumdan çıkıyor',
];

/** Oyun yayın onayı — herkes geliştirir, yayın kararı burada verilir */
export default function GamesReviewPage() {
  const [tab, setTab] = useState<GameAppStatus | 'all'>('in_review');
  const [rows, setRows] = useState<GameAppDto[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const req = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const token = getAccessToken();
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: { Authorization: token ? `Bearer ${token}` : '', 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.text()) || res.statusText);
    return res.json() as Promise<T>;
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await req<GameAppDto[]>(`/games/admin/list${tab === 'all' ? '' : `?status=${tab}`}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    }
  }, [req, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, action: 'approve' | 'reject' | 'suspend' | 'unsuspend') => {
    const note = (notes[id] ?? '').trim();
    if ((action === 'reject' || action === 'suspend') && !note) {
      setError('Red / askı için gerekçe yaz (geliştiriciye gönderilir).');
      return;
    }
    if (action === 'approve' && !window.confirm('Oyun tüm Dracord kullanıcılarına açılacak. Onaylıyor musun?')) return;
    setBusy(id);
    setError(null);
    try {
      await req(`/games/admin/${id}/review`, { method: 'POST', body: JSON.stringify({ action, note: note || undefined }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-dracula-fg">Oyunlar</h2>
          <p className="mt-1 text-sm text-dracula-comment">
            Geliştiriciler oyunlarını Ayarlar → Gelişmiş → Oyunlarım’dan gönderir. Onaylanan oyun tüm
            kullanıcıların ses kanalı oyun listesinde görünür. Onaylı oyunun adı/adresi değişirse otomatik
            yeniden incelemeye düşer.
          </p>
        </section>

        <details className="rounded border border-dracula-current bg-dracula-bg p-4 text-sm">
          <summary className="cursor-pointer font-medium text-dracula-purple">İnceleme kontrol listesi</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-dracula-comment">
            {CHECKLIST.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 text-sm ${tab === t.id ? 'bg-dracula-purple text-dracula-bg' : 'bg-dracula-current text-dracula-fg'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-dracula-red">{error}</p>}

        {rows.length === 0 ? (
          <p className="text-sm text-dracula-comment">Bu listede oyun yok.</p>
        ) : (
          <ul className="space-y-4">
            {rows.map((g) => (
              <li key={g.id} className="rounded border border-dracula-current bg-dracula-bg p-4 text-sm">
                <div className="flex items-start gap-3">
                  {g.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.iconUrl} alt="" className="h-14 w-14 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded bg-dracula-current" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-dracula-fg">
                      {g.name} <span className="text-dracula-comment">/{g.slug}</span>{' '}
                      <span className="ml-2 rounded bg-dracula-current px-1.5 py-0.5 text-xs">{g.status}</span>
                    </p>
                    <p className="text-dracula-comment">{g.shortDescription}</p>
                    <p className="mt-1 break-all">
                      <a href={g.entryUrl} target="_blank" rel="noreferrer" className="text-dracula-cyan underline">
                        {g.entryUrl}
                      </a>
                    </p>
                    <p className="mt-1 text-xs text-dracula-comment">
                      Sahip: {g.ownerName ?? g.ownerUserId} · {g.minPlayers}–{g.maxPlayers} oyuncu · {g.platforms.join(', ')} ·{' '}
                      {g.orientation}
                      {g.submittedAt ? ` · gönderim ${new Date(g.submittedAt).toLocaleString('tr-TR')}` : ''}
                    </p>
                    {g.description && (
                      <p className="mt-2 whitespace-pre-wrap text-dracula-fg/90 line-clamp-6">{g.description}</p>
                    )}
                    {g.reviewNote && <p className="mt-2 text-dracula-orange">Not: {g.reviewNote}</p>}
                  </div>
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setPreviewId((p) => (p === g.id ? null : g.id))}
                    className="text-dracula-purple underline"
                  >
                    {previewId === g.id ? 'Önizlemeyi kapat' : 'Önizle (sandbox iframe)'}
                  </button>
                  {previewId === g.id && (
                    <iframe
                      src={g.entryUrl}
                      title={`${g.name} önizleme`}
                      sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                      className="mt-2 h-96 w-full rounded border border-dracula-current bg-black"
                    />
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={notes[g.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [g.id]: e.target.value }))}
                    placeholder="Geliştiriciye not (red/askı için zorunlu)"
                    className="h-9 flex-1 rounded border border-dracula-current bg-dracula-bg-dark px-2 text-dracula-fg"
                  />
                  <div className="flex flex-wrap gap-2">
                    {g.status !== 'approved' && g.status !== 'suspended' && (
                      <button type="button" disabled={busy === g.id} onClick={() => void review(g.id, 'approve')} className="rounded bg-dracula-green px-3 py-1.5 font-medium text-dracula-bg disabled:opacity-60">
                        Onayla
                      </button>
                    )}
                    {(g.status === 'in_review' || g.status === 'approved') && (
                      <button type="button" disabled={busy === g.id} onClick={() => void review(g.id, 'reject')} className="rounded bg-dracula-orange px-3 py-1.5 font-medium text-dracula-bg disabled:opacity-60">
                        Reddet
                      </button>
                    )}
                    {g.status !== 'suspended' ? (
                      <button type="button" disabled={busy === g.id} onClick={() => void review(g.id, 'suspend')} className="rounded bg-dracula-red px-3 py-1.5 font-medium text-dracula-bg disabled:opacity-60">
                        Askıya al
                      </button>
                    ) : (
                      <button type="button" disabled={busy === g.id} onClick={() => void review(g.id, 'unsuspend')} className="rounded bg-dracula-current px-3 py-1.5 font-medium text-dracula-fg disabled:opacity-60">
                        Askıdan çıkar
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
