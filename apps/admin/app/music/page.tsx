'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { getApiBaseUrl } from '@/lib/client';
import { getAccessToken } from '@/lib/storage';

type View = {
  proxySet: boolean;
  proxyMasked: string | null;
  cookiesSet: boolean;
  cookieRows: number;
  cookieLoginHints: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  lastStatus: { ok: boolean; error?: string; via?: string; at?: string } | null;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { Authorization: token ? `Bearer ${token}` : '', 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const t = await res.text();
    let msg = t;
    try {
      msg = (JSON.parse(t) as { message?: string }).message ?? t;
    } catch {
      /* metin */
    }
    throw new Error(msg || res.statusText);
  }
  return res.json() as Promise<T>;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—');

/** Müzik botu: yt-dlp proxy + YouTube cookie (sunucuya girmeden güncelle) */
export default function MusicConfigPage() {
  const [v, setV] = useState<View | null>(null);
  const [proxy, setProxy] = useState('');
  const [cookies, setCookies] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setV(await req<View>('/platform-admin/music-config'));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Yüklenemedi' });
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const save = async (body: { proxy?: string | null; cookies?: string | null }, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      setV(await req<View>('/platform-admin/music-config', { method: 'PATCH', body: JSON.stringify(body) }));
      setMsg({ ok: true, text: ok });
      if (body.proxy !== undefined) setProxy('');
      if (body.cookies !== undefined) setCookies('');
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi' });
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded border border-dracula-current bg-dracula-bg-darker px-3 py-2 text-sm text-dracula-fg outline-none focus:border-dracula-purple';
  const btn = 'rounded px-3 py-1.5 text-sm disabled:opacity-50';

  return (
    <AdminShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-dracula-fg">Müzik botu (YouTube)</h2>
          <p className="text-sm text-dracula-comment">
            Buraya girilen proxy ve cookie sunucudaki .env değerlerinin yerine geçer; bot 30 sn içinde yenisini kullanır. Boş bırakıp
            “Kaldır” dersen .env’ye döner. Sırlar geri gösterilmez.
          </p>
        </div>

        {v?.lastStatus ? (
          <div className={`rounded-lg border p-3 text-sm ${v.lastStatus.ok ? 'border-dracula-green/50 text-dracula-green' : 'border-dracula-red/50 text-dracula-red'}`}>
            Son deneme ({fmt(v.lastStatus.at)}, {v.lastStatus.via ?? '—'}): {v.lastStatus.ok ? 'çalıştı ✓' : v.lastStatus.error}
          </div>
        ) : (
          <p className="text-sm text-dracula-comment">Son kayıttan beri şarkı açılmadı — bir kanalda çal, sonuç burada görünür.</p>
        )}

        <section className="space-y-2 rounded-lg border border-dracula-current p-4">
          <h3 className="font-semibold text-dracula-fg">Proxy</h3>
          <p className="text-sm text-dracula-comment">
            Şu an: <span className="font-mono text-dracula-fg">{v?.proxySet ? v.proxyMasked : '.env değeri (panelden girilmedi)'}</span>
          </p>
          <input
            className={`${input} font-mono`}
            value={proxy}
            onChange={(e) => setProxy(e.target.value)}
            placeholder="http://kullanici:parola@1.2.3.4:8000  ya da socks5://…"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !proxy.trim()} onClick={() => void save({ proxy: proxy.trim() }, 'Proxy kaydedildi')} className={`${btn} bg-dracula-purple text-dracula-bg`}>
              Kaydet
            </button>
            {v?.proxySet ? (
              <button type="button" disabled={busy} onClick={() => void save({ proxy: null }, 'Proxy kaldırıldı (.env geçerli)')} className={`${btn} border border-dracula-current text-dracula-fg`}>
                Kaldır
              </button>
            ) : null}
          </div>
          <p className="text-xs text-dracula-comment">
            Residential proxy önerilir; datacenter IP’leri YouTube çoğu zaman reddeder. Sağlayıcın IP beyaz listesi istiyorsa sunucu IP’sini orada güncel tut.
          </p>
        </section>

        <section className="space-y-2 rounded-lg border border-dracula-current p-4">
          <h3 className="font-semibold text-dracula-fg">YouTube cookie</h3>
          <p className="text-sm text-dracula-comment">
            Şu an:{' '}
            {v?.cookiesSet ? (
              <span className="text-dracula-fg">
                panelden · {v.cookieRows} satır · {v.cookieLoginHints ? 'oturum çerezi var ✓' : 'oturum çerezi YOK (LOGIN_INFO/PSID)'}
              </span>
            ) : (
              '.env değeri'
            )}
          </p>
          <textarea
            className={`${input} h-36 font-mono text-xs`}
            value={cookies}
            onChange={(e) => setCookies(e.target.value)}
            placeholder={'cookies.txt içeriğini (Netscape biçimi) ya da base64 hâlini yapıştır\n# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t…'}
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !cookies.trim()} onClick={() => void save({ cookies }, 'Cookie kaydedildi')} className={`${btn} bg-dracula-purple text-dracula-bg`}>
              Kaydet
            </button>
            {v?.cookiesSet ? (
              <button type="button" disabled={busy} onClick={() => void save({ cookies: null }, 'Cookie kaldırıldı (.env geçerli)')} className={`${btn} border border-dracula-current text-dracula-fg`}>
                Kaldır
              </button>
            ) : null}
          </div>
          <p className="text-xs text-dracula-comment">Gizli pencerede youtube.com’a gir → youtube.com/robots.txt aç → “Get cookies.txt LOCALLY” ile dışa aktar → pencereyi kapat.</p>
        </section>

        {msg ? <p className={`text-sm ${msg.ok ? 'text-dracula-green' : 'text-dracula-red'}`}>{msg.text}</p> : null}
        {v?.updatedAt ? <p className="text-xs text-dracula-comment">Son güncelleme: {fmt(v.updatedAt)}</p> : null}
      </div>
    </AdminShell>
  );
}
