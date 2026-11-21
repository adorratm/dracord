'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { getApiBaseUrl } from '@/lib/client';
import { getAccessToken } from '@/lib/storage';

type Row = {
  id: string;
  platform: string;
  message: string;
  stack: string;
  count: number;
  lastVersion: string | null;
  lastPath: string | null;
  lastAgent: string | null;
  resolved: boolean;
  firstSeen: string;
  lastSeen: string;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { Authorization: token ? `Bearer ${token}` : '', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json() as Promise<T>;
}

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'az önce';
  if (s < 3600) return `${Math.round(s / 60)} dk önce`;
  if (s < 86400) return `${Math.round(s / 3600)} sa önce`;
  return `${Math.round(s / 86400)} gün önce`;
};

const PLATFORMS = ['', 'web', 'desktop', 'mobile', 'admin'] as const;

/** Web/desktop/mobil istemci hataları — gruplanmış, en son görülen üstte */
export default function ClientErrorsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [last24, setLast24] = useState(0);
  const [platform, setPlatform] = useState<string>('');
  const [showResolved, setShowResolved] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (platform) q.set('platform', platform);
      if (!showResolved) q.set('resolved', 'false');
      const r = await req<{ items: Row[]; last24hEvents: number }>(`/platform-admin/client-errors?${q}`);
      setItems(r.items);
      setLast24(r.last24hEvents);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yüklenemedi');
    }
  }, [platform, showResolved]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (id: string, kind: 'resolve' | 'reopen' | 'delete') => {
    if (kind === 'delete') await req(`/platform-admin/client-errors/${id}`, { method: 'DELETE' });
    else await req(`/platform-admin/client-errors/${id}`, { method: 'PATCH', body: JSON.stringify({ resolved: kind === 'resolve' }) });
    await load();
  };

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <h2 className="text-xl font-semibold text-dracula-fg">İstemci hataları</h2>
            <p className="text-sm text-dracula-comment">Son 24 saatte {last24} olay · aynı hata tek satırda toplanır · kişisel veri ayıklanır</p>
          </div>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded border border-dracula-current bg-dracula-bg-darker px-2 py-1 text-sm text-dracula-fg">
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p || 'Tüm platformlar'}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-sm text-dracula-comment">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Çözülenleri göster
          </label>
        </div>
        {err ? <p className="text-sm text-dracula-red">{err}</p> : null}
        {items.length === 0 ? <p className="text-sm text-dracula-comment">Hata yok 🎉</p> : null}
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className={`rounded-lg border border-dracula-current p-3 ${r.resolved ? 'opacity-60' : ''}`}>
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-start gap-3 text-left">
                <span className="mt-0.5 shrink-0 rounded bg-dracula-current px-1.5 py-0.5 text-xs text-dracula-fg">{r.platform}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-dracula-fg">{r.message}</span>
                  <span className="block text-xs text-dracula-comment">
                    {r.count}× · son {ago(r.lastSeen)} · ilk {ago(r.firstSeen)}
                    {r.lastVersion ? ` · v${r.lastVersion}` : ''}
                    {r.lastPath ? ` · ${r.lastPath}` : ''}
                  </span>
                </span>
              </button>
              {open === r.id ? (
                <div className="mt-2 space-y-2">
                  {r.stack ? <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-dracula-bg-darker p-2 text-xs text-dracula-fg">{r.stack}</pre> : null}
                  {r.lastAgent ? <p className="text-xs text-dracula-comment">{r.lastAgent}</p> : null}
                  <div className="flex gap-2">
                    {r.resolved ? (
                      <button type="button" onClick={() => void act(r.id, 'reopen')} className="rounded border border-dracula-current px-2 py-1 text-xs text-dracula-fg">
                        Yeniden aç
                      </button>
                    ) : (
                      <button type="button" onClick={() => void act(r.id, 'resolve')} className="rounded bg-dracula-purple px-2 py-1 text-xs text-dracula-bg">
                        Çözüldü
                      </button>
                    )}
                    <button type="button" onClick={() => void act(r.id, 'delete')} className="rounded px-2 py-1 text-xs text-dracula-red">
                      Sil
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </AdminShell>
  );
}
