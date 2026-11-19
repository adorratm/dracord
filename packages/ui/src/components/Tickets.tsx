'use client';

import { useEffect, useState } from 'react';
import type { GuildTicketConfig, TicketDto } from '@dracord/types';
import { cn } from '../lib/cn';

export interface TicketsClient {
  getTicketConfig(guildId: string): Promise<GuildTicketConfig>;
  updateTicketConfig(guildId: string, cfg: GuildTicketConfig): Promise<GuildTicketConfig>;
  listTickets(guildId: string): Promise<TicketDto[]>;
  openTicket(guildId: string, subject: string): Promise<TicketDto>;
  closeTicket(id: string): Promise<TicketDto>;
  reopenTicket(id: string): Promise<TicketDto>;
}

const field =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';

/** B6 — open a support ticket; see mine (staff: all of them) */
export function TicketsPanel({
  client,
  guildId,
  meId,
  memberName,
  onOpenChannel,
}: {
  client: TicketsClient;
  guildId: string;
  meId: string;
  memberName: (id: string) => string;
  /** the ticket channel was created / chosen: go there (reload channels first) */
  onOpenChannel: (channelId: string) => void;
}) {
  const [cfg, setCfg] = useState<GuildTicketConfig | null>(null);
  const [list, setList] = useState<TicketDto[] | null>(null);
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void client.getTicketConfig(guildId).then(setCfg).catch(() => setCfg(null));
    void client.listTickets(guildId).then(setList).catch(() => setList([]));
  }, [client, guildId]);

  const put = (t: TicketDto) => setList((prev) => [t, ...(prev ?? []).filter((x) => x.id !== t.id)]);
  const run = async (fn: () => Promise<TicketDto>) => {
    setError(null);
    try {
      put(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  };

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const t = await client.openTicket(guildId, subject);
      put(t);
      setSubject('');
      onOpenChannel(t.channelId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Talep açılamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-space-md">
      {cfg?.enabled ? (
        <div className="rounded-xl bg-surface-container-low p-3 space-y-2">
          <p className="font-body-sm text-on-surface-variant">
            Yalnız sen ve sunucu ekibinin göreceği özel bir kanal açılır.
          </p>
          <div className="flex gap-2">
            <input className={field} value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="Konu (ör. Rolüm kayboldu)" aria-label="Konu" />
            <button
              type="button"
              disabled={busy || !subject.trim()}
              onClick={() => void open()}
              className="shrink-0 px-4 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50"
            >
              Talep aç
            </button>
          </div>
        </div>
      ) : cfg ? (
        <p className="font-body-sm text-on-surface-variant">Bu sunucuda destek talepleri kapalı.</p>
      ) : null}
      {error ? <p className="font-body-sm text-error">{error}</p> : null}
      {list && list.length ? (
        <ul className="divide-y divide-surface-container-high rounded-xl bg-surface-container-low">
          {list.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
              <span className={cn('h-2 w-2 rounded-full shrink-0', t.status === 'open' ? 'bg-dracula-green' : 'bg-outline')} aria-hidden />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenChannel(t.channelId)}>
                <span className="block truncate font-body-md text-on-surface">
                  #{t.number} · {t.subject}
                </span>
                <span className="block font-body-sm text-outline">
                  {t.openerId === meId ? 'Senin talebin' : memberName(t.openerId)} · {t.status === 'open' ? 'açık' : 'kapalı'}
                </span>
              </button>
              {t.status === 'open' ? (
                <button type="button" className="font-label-sm text-on-surface-variant hover:text-on-surface" onClick={() => void run(() => client.closeTicket(t.id))}>
                  Kapat
                </button>
              ) : t.openerId !== meId ? (
                <button type="button" className="font-label-sm text-primary" onClick={() => void run(() => client.reopenTicket(t.id))}>
                  Yeniden aç
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : list ? (
        <p className="font-body-sm text-outline">Henüz talep yok.</p>
      ) : null}
    </div>
  );
}

/** B6 — server settings: tickets on/off, category, staff roles, log channel, greeting */
export function TicketSettings({
  client,
  guildId,
  categories,
  channels,
  roles,
}: {
  client: TicketsClient;
  guildId: string;
  categories: Array<{ id: string; name: string }>;
  channels: Array<{ id: string; name: string }>;
  roles: Array<{ id: string; name: string }>;
}) {
  const [cfg, setCfg] = useState<GuildTicketConfig | null>(null);
  const [saved, setSaved] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    void client.getTicketConfig(guildId).then((c) => {
      setCfg(c);
      setSaved(JSON.stringify(c));
    });
  }, [client, guildId]);
  if (!cfg) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  const save = async () => {
    setMsg(null);
    try {
      const c = await client.updateTicketConfig(guildId, cfg);
      setCfg(c);
      setSaved(JSON.stringify(c));
      setMsg({ ok: true, text: 'Kaydedildi' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Kaydedilemedi' });
    }
  };
  return (
    <div className="space-y-space-sm">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-primary-container" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
        <span>
          <span className="block font-body-md text-on-surface">Destek talepleri açık</span>
          <span className="block font-body-sm text-on-surface-variant">
            Üyeler sunucu menüsünden talep açar; yalnız o üye ve ekip rolleri görür. Kanalları yönetenler her zaman görür.
          </span>
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select className={field} value={cfg.categoryId ?? ''} onChange={(e) => setCfg({ ...cfg, categoryId: e.target.value || null })} aria-label="Kategori">
          <option value="">Kategorisiz</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={field} value={cfg.logChannelId ?? ''} onChange={(e) => setCfg({ ...cfg, logChannelId: e.target.value || null })} aria-label="Kayıt kanalı">
          <option value="">Yeni talepleri duyurma</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      </div>
      <p className="font-label-sm text-outline">Ekip rolleri</p>
      <div className="flex flex-wrap gap-1.5">
        {roles
          .filter((r) => r.name !== '@everyone')
          .map((r) => {
            const on = cfg.staffRoleIds.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() => setCfg({ ...cfg, staffRoleIds: on ? cfg.staffRoleIds.filter((x) => x !== r.id) : [...cfg.staffRoleIds, r.id] })}
                className={cn('rounded-full border px-2.5 py-1 font-label-sm', on ? 'border-primary bg-primary-container/20 text-on-surface' : 'border-outline-variant text-on-surface-variant')}
              >
                {r.name}
              </button>
            );
          })}
      </div>
      <textarea
        className={cn(field, 'min-h-[4.5rem]')}
        value={cfg.greeting}
        maxLength={500}
        onChange={(e) => setCfg({ ...cfg, greeting: e.target.value })}
        placeholder="Karşılama (ör. Sorununu ayrıntılı yaz, ekip yanıtlayacak.)"
        aria-label="Karşılama"
      />
      <div className="flex items-center gap-3">
        <button type="button" disabled={JSON.stringify(cfg) === saved} onClick={() => void save()} className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50">
          Kaydet
        </button>
        {msg ? <span className={msg.ok ? 'font-body-sm text-dracula-green' : 'font-body-sm text-error'}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
