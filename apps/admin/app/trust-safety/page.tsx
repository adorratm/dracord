'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { getApiBaseUrl } from '@/lib/client';
import { getAccessToken } from '@/lib/storage';

type TsReport = {
  id: string;
  category: string;
  status: string;
  guildId: string | null;
  userId: string | null;
  score: number;
  summary: string | null;
  createdAt: string;
};

type TrustedGuild = {
  id: string;
  guildId: string;
  note: string | null;
  createdAt: string;
};

type ContentHashRow = {
  id: string;
  hashValue: string;
  algorithm: string;
  category: string;
  score: number;
  note: string | null;
  active: boolean;
  createdAt: string;
};

export default function TrustSafetyPage() {
  const [reports, setReports] = useState<TsReport[]>([]);
  const [trusted, setTrusted] = useState<TrustedGuild[]>([]);
  const [hashes, setHashes] = useState<ContentHashRow[]>([]);
  const [guildId, setGuildId] = useState('');
  const [note, setNote] = useState('');
  const [hashValue, setHashValue] = useState('');
  const [hashNote, setHashNote] = useState('');
  const [hashCategory, setHashCategory] = useState('csam');
  const [hashBulk, setHashBulk] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(() => {
    const token = getAccessToken();
    return {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const base = getApiBaseUrl();
    try {
      const [r, t, h] = await Promise.all([
        fetch(`${base}/platform-admin/trust-safety/reports`, {
          headers: authHeaders(),
          credentials: 'include',
        }),
        fetch(`${base}/platform-admin/trust-safety/trusted-guilds`, {
          headers: authHeaders(),
          credentials: 'include',
        }),
        fetch(`${base}/platform-admin/trust-safety/hashes`, {
          headers: authHeaders(),
          credentials: 'include',
        }),
      ]);
      if (!r.ok || !t.ok || !h.ok) throw new Error('T&S verisi alınamadı');
      setReports(await r.json());
      setTrusted(await t.json());
      setHashes(await h.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme hatası');
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (id: string, status: 'resolved' | 'dismissed') => {
    const base = getApiBaseUrl();
    await fetch(`${base}/platform-admin/trust-safety/reports/${id}/resolve`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    void load();
  };

  const addTrusted = async () => {
    if (!guildId.trim()) return;
    const base = getApiBaseUrl();
    await fetch(`${base}/platform-admin/trust-safety/trusted-guilds`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({ guildId: guildId.trim(), note: note.trim() || undefined }),
    });
    setGuildId('');
    setNote('');
    void load();
  };

  const removeTrusted = async (id: string) => {
    const base = getApiBaseUrl();
    await fetch(`${base}/platform-admin/trust-safety/trusted-guilds/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
      credentials: 'include',
    });
    void load();
  };

  const addHash = async () => {
    if (!hashValue.trim()) return;
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/platform-admin/trust-safety/hashes`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        hashValue: hashValue.trim(),
        category: hashCategory,
        note: hashNote.trim() || undefined,
      }),
    });
    if (!res.ok) {
      setError('Hash eklenemedi');
      return;
    }
    setHashValue('');
    setHashNote('');
    void load();
  };

  const deactivateHash = async (id: string) => {
    const base = getApiBaseUrl();
    await fetch(`${base}/platform-admin/trust-safety/hashes/${id}/deactivate`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
    });
    void load();
  };

  const importHashes = async () => {
    if (!hashBulk.trim()) return;
    setImportMsg(null);
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/platform-admin/trust-safety/hashes/import`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({ text: hashBulk }),
    });
    if (!res.ok) {
      setError('Toplu import başarısız');
      return;
    }
    const data = (await res.json()) as {
      imported?: number;
      skipped?: number;
    };
    setImportMsg(
      `İçe aktarıldı: ${data.imported ?? 0}, atlandı: ${data.skipped ?? 0}`,
    );
    setHashBulk('');
    void load();
  };

  return (
    <AdminShell>
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-dracula-fg">Trust &amp; Safety</h2>
          <p className="mt-1 text-sm text-dracula-comment">
            Otomatik rapor kuyruğu, TrustedGuild ve yerel içerik hash DB (PhotoDNA
            ortaklığı değil — import altyapısı).
          </p>
          {error ? <p className="mt-2 text-sm text-dracula-red">{error}</p> : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
            Açık raporlar
          </h3>
          <ul className="space-y-2">
            {reports.length === 0 ? (
              <li className="text-sm text-dracula-comment">Açık rapor yok.</li>
            ) : (
              reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dracula-current bg-dracula-bg p-3 text-sm"
                >
                  <div>
                    <span className="font-medium text-dracula-purple">{r.category}</span>
                    <span className="text-dracula-comment"> · {r.status}</span>
                    <p className="text-dracula-fg">{r.summary ?? '—'}</p>
                    <p className="text-xs text-dracula-comment">
                      guild={r.guildId ?? '—'} user={r.userId ?? '—'} score={r.score}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-dracula-green/20 px-2 py-1 text-dracula-green"
                      onClick={() => void resolve(r.id, 'resolved')}
                    >
                      Çöz
                    </button>
                    <button
                      type="button"
                      className="rounded bg-dracula-comment/20 px-2 py-1 text-dracula-comment"
                      onClick={() => void resolve(r.id, 'dismissed')}
                    >
                      Reddet
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
            Trusted sunucular
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded border border-dracula-current bg-dracula-bg-darker px-3 py-2 text-sm"
              placeholder="guildId"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
            />
            <input
              className="min-w-48 flex-1 rounded border border-dracula-current bg-dracula-bg-darker px-3 py-2 text-sm"
              placeholder="not"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-dracula-purple px-3 py-2 text-sm text-white"
              onClick={() => void addTrusted()}
            >
              Ekle
            </button>
          </div>
          <ul className="space-y-2">
            {trusted.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-dracula-current bg-dracula-bg p-3 text-sm"
              >
                <span>
                  <code className="text-dracula-cyan">{t.guildId}</code>
                  {t.note ? <span className="text-dracula-comment"> — {t.note}</span> : null}
                </span>
                <button
                  type="button"
                  className="text-dracula-red"
                  onClick={() => void removeTrusted(t.guildId)}
                >
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
            İçerik hash DB
          </h3>
          <p className="text-xs text-dracula-comment">
            SHA-256 öneki (hex). Tarama eşleşince T&S raporu açılır. Gerçek PhotoDNA /
            NCMEC feed’i yasal ortaklık ister.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-56 flex-1 rounded border border-dracula-current bg-dracula-bg-darker px-3 py-2 font-mono text-sm"
              placeholder="hashValue (hex)"
              value={hashValue}
              onChange={(e) => setHashValue(e.target.value)}
            />
            <select
              className="rounded border border-dracula-current bg-dracula-bg-darker px-3 py-2 text-sm"
              value={hashCategory}
              onChange={(e) => setHashCategory(e.target.value)}
            >
              <option value="csam">csam</option>
              <option value="sexual">sexual</option>
              <option value="violence">violence</option>
              <option value="other">other</option>
            </select>
            <input
              className="min-w-40 flex-1 rounded border border-dracula-current bg-dracula-bg-darker px-3 py-2 text-sm"
              placeholder="not"
              value={hashNote}
              onChange={(e) => setHashNote(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-dracula-purple px-3 py-2 text-sm text-white"
              onClick={() => void addHash()}
            >
              Hash ekle
            </button>
          </div>
          <div className="space-y-2">
            <textarea
              className="w-full min-h-24 rounded border border-dracula-current bg-dracula-bg-darker px-3 py-2 font-mono text-xs"
              placeholder={'# satır: hash[,algorithm,category,score,note]\nabc123def...\ndef456...,sha256-prefix,csam,0.99,ornek'}
              value={hashBulk}
              onChange={(e) => setHashBulk(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-dracula-cyan/30 px-3 py-2 text-sm text-dracula-cyan"
              onClick={() => void importHashes()}
            >
              Toplu import
            </button>
            {importMsg ? (
              <p className="text-xs text-dracula-green">{importMsg}</p>
            ) : null}
          </div>
          <ul className="space-y-2">
            {hashes.length === 0 ? (
              <li className="text-sm text-dracula-comment">Hash kaydı yok.</li>
            ) : (
              hashes.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dracula-current bg-dracula-bg p-3 text-sm"
                >
                  <div>
                    <code className="text-dracula-cyan">{h.hashValue.slice(0, 24)}…</code>
                    <span className="text-dracula-comment">
                      {' '}
                      · {h.category} · {h.active ? 'aktif' : 'pasif'}
                    </span>
                    {h.note ? <p className="text-xs text-dracula-comment">{h.note}</p> : null}
                  </div>
                  {h.active ? (
                    <button
                      type="button"
                      className="text-dracula-red"
                      onClick={() => void deactivateHash(h.id)}
                    >
                      Pasifleştir
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
