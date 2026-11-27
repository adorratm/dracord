'use client';

import { useEffect, useState } from 'react';
import type { StreamAlertDto, StreamAlertsListDto, StreamPlatform } from '@dracord/types';

export type StreamAlertsClient = {
  listStreamAlerts(guildId: string): Promise<StreamAlertsListDto>;
  createStreamAlert(guildId: string, input: { platform: StreamPlatform; handle: string; channelId: string; message?: string | null }): Promise<StreamAlertDto>;
  updateStreamAlert(guildId: string, id: string, input: { channelId?: string; message?: string | null }): Promise<StreamAlertDto>;
  deleteStreamAlert(guildId: string, id: string): Promise<unknown>;
  testStreamAlert(guildId: string, id: string): Promise<unknown>;
};

export interface StreamAlertsPanelProps {
  client: StreamAlertsClient;
  guildId: string;
  /** sunucunun metin kanalları */
  channels: Array<{ id: string; name: string }>;
}

const PLATFORM: Record<StreamPlatform, { label: string; color: string; ink: string; placeholder: string }> = {
  youtube: { label: 'YouTube', color: '#ff0033', ink: '#ffffff', placeholder: 'youtube.com/@kanal ya da /channel/UC…' },
  twitch: { label: 'Twitch', color: '#9146ff', ink: '#ffffff', placeholder: 'twitch.tv/kullanici ya da kullanıcı adı' },
  kick: { label: 'Kick', color: '#53fc18', ink: '#0b0e0f', placeholder: 'kick.com/kanal ya da kanal adı' },
};

const field = 'h-10 rounded-lg bg-surface-container-highest px-space-sm font-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary';

/** D7 — Twitch / YouTube yayın bildirimleri (Sunucuyu yönet) */
export function StreamAlertsPanel({ client, guildId, channels }: StreamAlertsPanelProps) {
  const [data, setData] = useState<StreamAlertsListDto | null>(null);
  const [platform, setPlatform] = useState<StreamPlatform>('youtube');
  const [handle, setHandle] = useState('');
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    client
      .listStreamAlerts(guildId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setNote({ ok: false, text: e instanceof Error ? e.message : 'Yüklenemedi' }));
    return () => {
      alive = false;
    };
  }, [client, guildId]);

  useEffect(() => {
    if (!channelId && channels[0]) setChannelId(channels[0].id);
  }, [channels, channelId]);

  const act = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setNote(null);
    try {
      const t = await fn();
      if (t) setNote({ ok: true, text: t });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'İşlem başarısız' });
    } finally {
      setBusy(null);
    }
  };

  if (!data) return note ? <p className="font-body-sm text-error">{note.text}</p> : <div className="h-24 animate-pulse rounded-xl bg-surface-container-high" />;

  const chName = (id: string) => channels.find((c) => c.id === id)?.name ?? 'silinmiş kanal';
  const full = data.alerts.length >= data.max;

  return (
    <div className="space-y-space-md">
      <form
        className="grid gap-space-sm rounded-xl bg-surface-container-high p-space-md sm:grid-cols-[auto_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          void act('add', async () => {
            const a = await client.createStreamAlert(guildId, { platform, handle: handle.trim(), channelId, message: message.trim() || null });
            setData((d) => (d ? { ...d, alerts: [...d.alerts, a] } : d));
            setHandle('');
            setMessage('');
            return `${a.displayName} eklendi. Yeni ${platform === 'youtube' ? 'videolar ve yayınlar' : 'yayınlar'} #${chName(a.channelId)} kanalına düşecek.`;
          });
        }}
      >
        <div className="flex rounded-lg bg-surface-container-highest p-0.5 sm:row-span-1">
          {(['youtube', 'twitch', 'kick'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              aria-pressed={platform === p}
              className={`rounded-md px-3 py-1.5 font-label-md ${platform === p ? '' : 'text-on-surface-variant hover:text-on-surface'}`}
              style={platform === p ? { background: PLATFORM[p].color, color: PLATFORM[p].ink } : undefined}
            >
              {PLATFORM[p].label}
            </button>
          ))}
        </div>
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={PLATFORM[platform].placeholder} aria-label="Yayıncı" className={field} required maxLength={200} />
        <label className="self-center font-label-sm text-on-surface-variant">Kanal</label>
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={field} aria-label="Bildirim kanalı">
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <label className="self-center font-label-sm text-on-surface-variant">Mesaj</label>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          placeholder="İsteğe bağlı — {name} {title} {url} kullanılabilir"
          aria-label="Özel mesaj"
          className={field}
        />
        <div className="flex items-center gap-space-sm sm:col-span-2">
          <button
            type="submit"
            disabled={!!busy || full || !handle.trim() || !channelId || (platform === 'twitch' && !data.twitchEnabled) || (platform === 'kick' && !data.kickEnabled)}
            className="rounded-lg bg-primary px-4 py-2 font-label-md text-on-primary disabled:opacity-50"
          >
            {busy === 'add' ? 'Ekleniyor…' : 'Ekle'}
          </button>
          <span className="font-label-sm text-on-surface-variant">
            {data.alerts.length}/{data.max}
            {platform === 'twitch' && !data.twitchEnabled ? ' · Twitch henüz bu sunucuda açılmadı' : ''}
            {platform === 'kick' && !data.kickEnabled ? ' · Kick henüz bu sunucuda açılmadı' : ''}
          </span>
        </div>
      </form>

      {note && <p className={`font-body-sm ${note.ok ? 'text-on-surface' : 'text-error'}`}>{note.text}</p>}

      {data.alerts.length === 0 ? (
        <p className="font-body-sm text-on-surface-variant">Henüz yayıncı eklenmedi. Bir YouTube kanalı ya da Twitch yayıncısı ekle; yeni yayın ve videolarda bot haber verir.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/40 rounded-xl bg-surface-container-high">
          {data.alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-space-sm p-space-sm">
              <span className="rounded px-1.5 py-0.5 font-label-sm" style={{ background: PLATFORM[a.platform].color, color: PLATFORM[a.platform].ink }}>
                {PLATFORM[a.platform].label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-body-md text-on-surface">
                  {a.displayName}
                  {a.isLive ? <span className="ml-2 font-label-sm text-error">● canlı</span> : null}
                </span>
                <span className="block truncate font-label-sm text-on-surface-variant">
                  → #{chName(a.channelId)}
                  {a.lastNotifiedAt ? ` · son bildirim ${new Date(a.lastNotifiedAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                  {a.lastError ? <span className="text-error"> · {a.lastError}</span> : null}
                </span>
              </span>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void act(`t${a.id}`, async () => {
                  await client.testStreamAlert(guildId, a.id);
                  return `Deneme mesajı #${chName(a.channelId)} kanalına gönderildi.`;
                })}
                className="rounded-lg px-3 py-1.5 font-label-sm text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
              >
                Dene
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  window.confirm(`${a.displayName} bildirimi kaldırılsın mı?`) &&
                  void act(`d${a.id}`, async () => {
                    await client.deleteStreamAlert(guildId, a.id);
                    setData((d) => (d ? { ...d, alerts: d.alerts.filter((x) => x.id !== a.id) } : d));
                  })
                }
                className="rounded-lg px-3 py-1.5 font-label-sm text-error hover:bg-error/10 disabled:opacity-50"
              >
                Kaldır
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="font-label-sm text-outline">Kanallar birkaç dakikada bir kontrol edilir. YouTube'da eklemeden önceki videolar bildirilmez.</p>
    </div>
  );
}
