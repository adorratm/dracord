'use client';

import { useEffect, useState } from 'react';
import type { CreateGiveawayInput, GiveawayDto, GuildBirthdayConfig, MyBirthdayDto } from '@dracord/types';
import { cn } from '../lib/cn';
import { isSelfAssignableRole } from './GuildOnboarding';

export interface GiveawaysClient {
  listGiveaways(guildId: string): Promise<GiveawayDto[]>;
  createGiveaway(guildId: string, input: CreateGiveawayInput): Promise<GiveawayDto>;
  toggleGiveawayEntry(id: string): Promise<GiveawayDto>;
  endGiveaway(id: string): Promise<GiveawayDto>;
  rerollGiveaway(id: string): Promise<GiveawayDto>;
  onGiveawayUpdate(handler: (g: GiveawayDto) => void): () => void;
}

export interface BirthdaysClient {
  getMyBirthday(): Promise<MyBirthdayDto>;
  setMyBirthday(input: MyBirthdayDto): Promise<MyBirthdayDto>;
  getGuildBirthdays(guildId: string): Promise<GuildBirthdayConfig>;
  updateGuildBirthdays(guildId: string, cfg: GuildBirthdayConfig): Promise<GuildBirthdayConfig>;
}

const field =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';

function left(iso: string): string {
  const s = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000));
  if (s >= 86400) return `${Math.floor(s / 86400)} gün ${Math.floor((s % 86400) / 3600)} sa`;
  if (s >= 3600) return `${Math.floor(s / 3600)} sa ${Math.floor((s % 3600) / 60)} dk`;
  if (s >= 60) return `${Math.floor(s / 60)} dk`;
  return `${s} sn`;
}

const DURATIONS = [
  { min: 10, label: '10 dakika' },
  { min: 60, label: '1 saat' },
  { min: 360, label: '6 saat' },
  { min: 1440, label: '1 gün' },
  { min: 4320, label: '3 gün' },
  { min: 10080, label: '1 hafta' },
];

/** B7 — giveaways in this server: enter with one click; hosts start, end early and reroll */
export function GiveawaysPanel({
  client,
  guildId,
  meId,
  canHost,
  channels,
  roles,
  memberName,
}: {
  client: GiveawaysClient;
  guildId: string;
  meId: string;
  canHost: boolean;
  channels: Array<{ id: string; name: string }>;
  roles: Array<{ id: string; name: string }>;
  memberName: (id: string) => string;
}) {
  const [list, setList] = useState<GiveawayDto[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateGiveawayInput>({ channelId: channels[0]?.id ?? '', prize: '', description: '', winnersCount: 1, durationMin: 1440, requiredRoleId: null });
  const [error, setError] = useState<string | null>(null);
  const [, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    void client.listGiveaways(guildId).then((l) => alive && setList(l)).catch(() => alive && setList([]));
    // room updates carry no viewer: keep my own `entered`
    const off = client.onGiveawayUpdate((g) => {
      if (g.guildId !== guildId) return;
      setList((prev) => {
        const cur = prev ?? [];
        const old = cur.find((x) => x.id === g.id);
        const merged = { ...g, entered: old?.entered ?? false };
        return old ? cur.map((x) => (x.id === g.id ? merged : x)) : [merged, ...cur];
      });
    });
    const tick = setInterval(() => setNow((n) => n + 1), 1000);
    return () => {
      alive = false;
      off();
      clearInterval(tick);
    };
  }, [client, guildId]);

  const put = (g: GiveawayDto) => setList((prev) => [g, ...(prev ?? []).filter((x) => x.id !== g.id)]);
  const run = async (fn: () => Promise<GiveawayDto>) => {
    setError(null);
    try {
      put(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  };

  const open = (list ?? []).filter((g) => !g.endedAt);
  const ended = (list ?? []).filter((g) => g.endedAt);

  return (
    <div className="space-y-space-md">
      {canHost ? (
        <button type="button" onClick={() => setCreating((c) => !c)} className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md">
          {creating ? 'Vazgeç' : 'Çekiliş başlat'}
        </button>
      ) : null}
      {creating ? (
        <div className="rounded-xl bg-surface-container-low p-3 space-y-2">
          <input className={field} value={form.prize} maxLength={120} onChange={(e) => setForm({ ...form, prize: e.target.value })} placeholder="Ödül (ör. 1 aylık Takviye)" aria-label="Ödül" />
          <input className={field} value={form.description ?? ''} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Açıklama (isteğe bağlı)" aria-label="Açıklama" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select className={field} value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })} aria-label="Duyuru kanalı">
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
            <select className={field} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} aria-label="Süre">
              {DURATIONS.map((d) => (
                <option key={d.min} value={d.min}>
                  {d.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 font-body-sm text-on-surface-variant">
              <input type="number" min={1} max={20} className={field} value={form.winnersCount} onChange={(e) => setForm({ ...form, winnersCount: Number(e.target.value) })} aria-label="Kazanan sayısı" />
            </label>
            <select className={field} value={form.requiredRoleId ?? ''} onChange={(e) => setForm({ ...form, requiredRoleId: e.target.value || null })} aria-label="Gereken rol">
              <option value="">Herkes katılabilir</option>
              {roles
                .filter((r) => r.name !== '@everyone')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    Yalnız {r.name}
                  </option>
                ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!form.prize.trim() || !form.channelId}
            onClick={() =>
              void run(async () => {
                const g = await client.createGiveaway(guildId, { ...form, description: form.description?.trim() || null });
                setCreating(false);
                setForm({ ...form, prize: '', description: '' });
                return g;
              })
            }
            className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50"
          >
            Başlat
          </button>
        </div>
      ) : null}
      {error ? <p className="font-body-sm text-error">{error}</p> : null}
      {list === null ? <p className="font-body-sm text-outline">Yükleniyor…</p> : null}
      {list && open.length === 0 && ended.length === 0 ? <p className="font-body-sm text-on-surface-variant">Şu an çekiliş yok.</p> : null}
      <ul className="space-y-2">
        {open.map((g) => (
          <li key={g.id} className="rounded-xl bg-surface-container-low p-3 flex items-start gap-3">
            <span className="text-2xl" aria-hidden>
              🎁
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-headline-md text-on-surface break-words">{g.prize}</p>
              {g.description ? <p className="font-body-sm text-on-surface break-words">{g.description}</p> : null}
              <p className="font-body-sm text-on-surface-variant">
                {g.winnersCount} kazanan · {g.entrantCount} katılımcı · {left(g.endsAt)} kaldı
                {g.requiredRoleId ? ` · yalnız ${roles.find((r) => r.id === g.requiredRoleId)?.name ?? 'bir rol'}` : ''}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                aria-pressed={g.entered}
                onClick={() => void run(() => client.toggleGiveawayEntry(g.id))}
                className={cn('px-3 py-1.5 rounded-lg font-label-sm', g.entered ? 'bg-dracula-green/25 text-on-surface' : 'bg-primary-container text-on-primary-container')}
              >
                {g.entered ? '✓ Katıldın' : 'Katıl'}
              </button>
              {canHost || g.hostId === meId ? (
                <button type="button" onClick={() => void run(() => client.endGiveaway(g.id))} className="px-3 py-1 rounded-lg text-on-surface-variant font-label-sm hover:text-on-surface">
                  Şimdi bitir
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {ended.length ? (
        <div>
          <h3 className="font-label-sm uppercase tracking-wider text-outline mb-1">Biten çekilişler</h3>
          <ul className="space-y-1.5">
            {ended.map((g) => (
              <li key={g.id} className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
                <span className="min-w-0 flex-1 font-body-sm text-on-surface truncate">
                  <strong>{g.prize}</strong> — {g.winnerIds.length ? g.winnerIds.map(memberName).join(', ') : 'katılan olmadı'}
                </span>
                {(canHost || g.hostId === meId) && g.entrantCount > g.winnerIds.length ? (
                  <button type="button" onClick={() => void run(() => client.rerollGiveaway(g.id))} className="font-label-sm text-primary">
                    Yeniden çek
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** B7 — user settings: my birthday (day + month only) and whether servers celebrate it */
export function MyBirthdaySettings({ client }: { client: BirthdaysClient }) {
  const [val, setVal] = useState<MyBirthdayDto | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    void client.getMyBirthday().then(setVal).catch(() => setVal({ birthday: null, share: false }));
  }, [client]);
  if (!val) return null;
  const [mm, dd] = val.birthday ? val.birthday.split('-').map(Number) : [0, 0];
  const save = async (next: MyBirthdayDto) => {
    setMsg(null);
    try {
      setVal(await client.setMyBirthday(next));
      setMsg({ ok: true, text: 'Kaydedildi' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Kaydedilemedi' });
    }
  };
  const pick = (m: number, d: number) => {
    if (!m || !d) return void save({ birthday: null, share: false });
    const day = Math.min(d, DAYS_IN[m - 1]!);
    void save({ birthday: `${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`, share: val.share });
  };
  return (
    <div className="px-space-md py-space-md space-y-2">
      <p className="font-body-md text-on-surface">Doğum günü</p>
      <p className="font-body-sm text-on-surface-variant">Yalnız gün ve ay tutulur. Açarsan, doğum günü kutlaması açık sunucularında o gün kutlanırsın.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select className={cn(field, 'w-auto')} value={dd || ''} onChange={(e) => pick(mm || 1, Number(e.target.value))} aria-label="Gün">
          <option value="">Gün</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select className={cn(field, 'w-auto')} value={mm || ''} onChange={(e) => pick(Number(e.target.value), dd || 1)} aria-label="Ay">
          <option value="">Ay</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        {val.birthday ? (
          <button type="button" className="font-label-sm text-on-surface-variant hover:text-error" onClick={() => void save({ birthday: null, share: false })}>
            Kaldır
          </button>
        ) : null}
      </div>
      <label className={cn('flex items-center gap-2 font-body-sm text-on-surface', !val.birthday && 'opacity-50')}>
        <input type="checkbox" className="accent-primary-container" disabled={!val.birthday} checked={val.share} onChange={(e) => void save({ ...val, share: e.target.checked })} />
        Sunucularımda kutlansın
      </label>
      {msg ? <p className={msg.ok ? 'font-body-sm text-dracula-green' : 'font-body-sm text-error'}>{msg.text}</p> : null}
    </div>
  );
}

/** B7 — server settings: where birthdays are celebrated, and a role for the day */
export function GuildBirthdaySettings({
  client,
  guildId,
  channels,
  roles,
}: {
  client: BirthdaysClient;
  guildId: string;
  channels: Array<{ id: string; name: string }>;
  roles: Array<{ id: string; name: string; permissions?: string[] }>;
}) {
  const [cfg, setCfg] = useState<GuildBirthdayConfig | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    void client.getGuildBirthdays(guildId).then(setCfg);
  }, [client, guildId]);
  if (!cfg) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  const save = async (next: GuildBirthdayConfig) => {
    setCfg(next);
    setMsg(null);
    try {
      setCfg(await client.updateGuildBirthdays(guildId, next));
      setMsg({ ok: true, text: 'Kaydedildi' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Kaydedilemedi' });
    }
  };
  return (
    <div className="space-y-space-sm">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-primary-container" checked={cfg.enabled} onChange={(e) => void save({ ...cfg, enabled: e.target.checked })} />
        <span>
          <span className="block font-body-md text-on-surface">Doğum günlerini kutla</span>
          <span className="block font-body-sm text-on-surface-variant">
            Doğum gününü paylaşan üyeler o gün saat 09:00’da seçtiğin kanalda kutlanır.
          </span>
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select className={field} value={cfg.channelId ?? ''} onChange={(e) => void save({ ...cfg, channelId: e.target.value || null })} aria-label="Kutlama kanalı">
          <option value="">Kanal seç…</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <select className={field} value={cfg.roleId ?? ''} onChange={(e) => void save({ ...cfg, roleId: e.target.value || null })} aria-label="Günün rolü">
          <option value="">Rol verme</option>
          {roles.filter(isSelfAssignableRole).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} (o gün)
            </option>
          ))}
        </select>
      </div>
      {msg ? <p className={msg.ok ? 'font-body-sm text-dracula-green' : 'font-body-sm text-error'}>{msg.text}</p> : null}
    </div>
  );
}
