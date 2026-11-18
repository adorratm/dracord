'use client';

import { useEffect, useState } from 'react';
import type { GuildStarboardConfig } from '@dracord/types';
import { cn } from '../lib/cn';

export interface StarboardClient {
  getStarboard(guildId: string): Promise<GuildStarboardConfig>;
  updateStarboard(guildId: string, cfg: GuildStarboardConfig): Promise<GuildStarboardConfig>;
}

const field =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';

/** B9 — yıldız panosu: yeterince ⭐ alan mesajlar seçilen kanala düşer */
export function StarboardSettings({
  client,
  guildId,
  channels,
}: {
  client: StarboardClient;
  guildId: string;
  channels: Array<{ id: string; name: string }>;
}) {
  const [cfg, setCfg] = useState<GuildStarboardConfig | null>(null);
  const [saved, setSaved] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void client.getStarboard(guildId).then((c) => {
      setCfg(c);
      setSaved(JSON.stringify(c));
    });
  }, [client, guildId]);

  if (!cfg) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  const dirty = JSON.stringify(cfg) !== saved;
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const c = await client.updateStarboard(guildId, cfg);
      setCfg(c);
      setSaved(JSON.stringify(c));
      setMsg({ ok: true, text: 'Kaydedildi' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Kaydedilemedi' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-space-sm">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-primary-container" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
        <span>
          <span className="block font-body-md text-on-surface">Yıldız panosu açık</span>
          <span className="block font-body-sm text-on-surface-variant">
            Bir mesaj seçtiğin emojiden yeterince tepki alınca pano kanalına kopyalanır; sayı canlı güncellenir.
          </span>
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_5rem_6rem] gap-2">
        <select className={field} value={cfg.channelId ?? ''} onChange={(e) => setCfg({ ...cfg, channelId: e.target.value || null })} aria-label="Pano kanalı">
          <option value="">Pano kanalı seç…</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <input className={cn(field, 'text-center')} value={cfg.emoji} maxLength={8} onChange={(e) => setCfg({ ...cfg, emoji: e.target.value })} aria-label="Emoji" />
        <input
          type="number"
          min={1}
          max={50}
          className={field}
          value={cfg.threshold}
          onChange={(e) => setCfg({ ...cfg, threshold: Number(e.target.value) })}
          aria-label="Gereken tepki"
          title="Gereken tepki sayısı"
        />
      </div>
      <details>
        <summary className="cursor-pointer font-label-sm text-on-surface-variant">Panoya düşmeyecek kanallar ({cfg.ignoredChannelIds.length})</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {channels.map((c) => {
            const on = cfg.ignoredChannelIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setCfg({ ...cfg, ignoredChannelIds: on ? cfg.ignoredChannelIds.filter((x) => x !== c.id) : [...cfg.ignoredChannelIds, c.id] })}
                className={cn('rounded-full border px-2.5 py-1 font-label-sm', on ? 'border-error text-error' : 'border-outline-variant text-on-surface-variant')}
              >
                #{c.name}
              </button>
            );
          })}
        </div>
      </details>
      <div className="flex items-center gap-3">
        <button type="button" disabled={!dirty || busy} onClick={() => void save()} className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50">
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {msg ? <span className={msg.ok ? 'font-body-sm text-dracula-green' : 'font-body-sm text-error'}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
