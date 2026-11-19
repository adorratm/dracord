'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SUBSCRIPTION_LIMITS,
  type GuildSubscriptionCodeDto,
  type GuildSubscriptionDto,
  type GuildSubscriptionTierDto,
  type GuildSubscriptionsOverview,
  type PublicUser,
} from '@dracord/types';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';

type TierInput = Partial<Pick<GuildSubscriptionTierDto, 'name' | 'perks' | 'priceText' | 'roleId' | 'paymentUrl' | 'color' | 'position'>>;

export interface SubscriptionsClient {
  getGuildSubscriptions(guildId: string): Promise<GuildSubscriptionsOverview>;
  redeemSubscriptionCode(guildId: string, code: string): Promise<GuildSubscriptionDto>;
  createSubscriptionTier(guildId: string, input: TierInput): Promise<GuildSubscriptionTierDto>;
  updateSubscriptionTier(guildId: string, tierId: string, input: TierInput): Promise<GuildSubscriptionTierDto>;
  deleteSubscriptionTier(guildId: string, tierId: string): Promise<{ ok: true }>;
  listGuildSubscribers(guildId: string): Promise<GuildSubscriptionDto[]>;
  grantGuildSubscription(guildId: string, input: { userId: string; tierId: string; days: number | null }): Promise<GuildSubscriptionDto>;
  revokeGuildSubscription(guildId: string, subId: string): Promise<{ ok: true }>;
  listSubscriptionCodes(guildId: string): Promise<GuildSubscriptionCodeDto[]>;
  createSubscriptionCodes(guildId: string, input: { tierId: string; days: number | null; count: number; maxUses: number }): Promise<GuildSubscriptionCodeDto[]>;
  deleteSubscriptionCode(guildId: string, codeId: string): Promise<{ ok: true }>;
  getGuildMembers(guildId: string): Promise<PublicUser[]>;
}

const field =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';
const btn = 'rounded-lg px-3 py-1.5 font-label-md disabled:opacity-50';
const errText = (e: unknown) => (e instanceof Error ? e.message : 'İşlem başarısız');
const until = (iso: string | null) => (iso ? `${new Date(iso).toLocaleDateString('tr-TR')} tarihine kadar` : 'süresiz');
const DURATIONS: Array<{ label: string; days: number | null }> = [
  { label: '7 gün', days: 7 },
  { label: '30 gün', days: 30 },
  { label: '90 gün', days: 90 },
  { label: '1 yıl', days: 365 },
  { label: 'Süresiz', days: null },
];

/** F2 — üye görünümü: kademeler, avantajlar, sahibin ödeme bağlantısı, kod kullan */
export function SubscriptionsPanel({ client, guildId }: { client: SubscriptionsClient; guildId: string }) {
  const [ov, setOv] = useState<GuildSubscriptionsOverview | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => client.getGuildSubscriptions(guildId).then(setOv), [client, guildId]);
  useEffect(() => {
    void load().catch(() => setOv({ tiers: [], mine: [], canManage: false }));
  }, [load]);

  const redeem = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const s = await client.redeemSubscriptionCode(guildId, code);
      setCode('');
      await load();
      const t = ov?.tiers.find((x) => x.id === s.tierId);
      setMsg({ ok: true, text: `${t?.name ?? 'Üyelik'} açıldı — ${until(s.expiresAt)}.` });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!ov) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  return (
    <div className="space-y-space-md">
      {ov.tiers.length === 0 ? (
        <p className="font-body-sm text-on-surface-variant">
          Bu sunucuda henüz abonelik kademesi yok.{ov.canManage ? ' Sunucu ayarları › Abonelikler bölümünden ekleyebilirsin.' : ''}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {ov.tiers.map((t) => {
            const mine = ov.mine.find((m) => m.tierId === t.id);
            return (
              <li
                key={t.id}
                className="flex flex-col gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-md"
                style={t.color ? { borderColor: `${t.color}99` } : undefined}
              >
                <div className="flex items-baseline gap-2">
                  <span className="material-symbols-outlined text-[20px]" style={t.color ? { color: t.color } : undefined} aria-hidden>
                    workspace_premium
                  </span>
                  <h4 className="min-w-0 flex-1 truncate font-headline-sm text-on-surface">{t.name}</h4>
                  {t.priceText ? <span className="shrink-0 font-label-md text-primary">{t.priceText}</span> : null}
                </div>
                {t.perks ? <p className="whitespace-pre-wrap font-body-sm text-on-surface-variant">{t.perks}</p> : null}
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  {mine ? (
                    <span className="rounded-full bg-primary-container/30 px-2 py-0.5 font-label-sm text-on-surface">✓ Aktif · {until(mine.expiresAt)}</span>
                  ) : null}
                  {t.paymentUrl ? (
                    <a
                      href={t.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className={cn(btn, mine ? 'bg-surface-container-high text-on-surface' : 'bg-primary text-on-primary')}
                    >
                      {mine ? 'Yenile' : 'Destek ol'} ↗
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {ov.tiers.some((t) => t.paymentUrl) ? (
        <p className="font-body-sm text-outline">
          Ödeme bağlantıları sunucu sahibine aittir; ödeme doğrudan ona yapılır, Dracord aracılık etmez ve iade/teslimden sorumlu değildir.
          Ödemeden sonra sahibinden bir üyelik kodu iste.
        </p>
      ) : null}
      {ov.tiers.length ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void redeem();
          }}
        >
          <input
            className={cn(field, 'min-w-[12rem] flex-1 font-mono uppercase')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD-EFGH-JKLM"
            aria-label="Üyelik kodu"
            maxLength={20}
          />
          <button type="submit" disabled={busy || code.replace(/[^a-z0-9]/gi, '').length < 12} className={cn(btn, 'bg-primary text-on-primary')}>
            Kodu kullan
          </button>
        </form>
      ) : null}
      {msg ? <p className={cn('font-body-sm', msg.ok ? 'text-primary' : 'text-error')}>{msg.text}</p> : null}
    </div>
  );
}

function TierForm({
  initial,
  roles,
  onSave,
  onCancel,
}: {
  initial?: GuildSubscriptionTierDto;
  roles: Array<{ id: string; name: string }>;
  onSave: (i: TierInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [priceText, setPrice] = useState(initial?.priceText ?? '');
  const [perks, setPerks] = useState(initial?.perks ?? '');
  const [roleId, setRole] = useState(initial?.roleId ?? '');
  const [paymentUrl, setUrl] = useState(initial?.paymentUrl ?? '');
  const [color, setColor] = useState(initial?.color ?? '#bd93f9');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-2 rounded-xl border border-outline-variant/40 p-space-md"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        void onSave({ name, priceText, perks, roleId: roleId || null, paymentUrl: paymentUrl.trim() || null, color })
          .catch((x) => setErr(errText(x)))
          .finally(() => setBusy(false));
      }}
    >
      <div className="flex gap-2">
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={SUBSCRIPTION_LIMITS.nameMax} placeholder="Kademe adı (ör. Destekçi)" required />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 shrink-0 rounded-lg bg-transparent" aria-label="Renk" />
      </div>
      <input className={field} value={priceText} onChange={(e) => setPrice(e.target.value)} maxLength={SUBSCRIPTION_LIMITS.priceMax} placeholder="Fiyat metni (ör. ₺50 / ay) — yalnız gösterim" />
      <textarea className={field} rows={3} value={perks} onChange={(e) => setPerks(e.target.value)} maxLength={SUBSCRIPTION_LIMITS.perksMax} placeholder="Avantajlar (özel kanal, rozet rengi, öncelikli destek…)" />
      <label className="block font-label-sm text-on-surface-variant">
        Verilecek rol
        <select className={cn(field, 'mt-1')} value={roleId} onChange={(e) => setRole(e.target.value)}>
          <option value="">— rol yok —</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <input className={field} value={paymentUrl} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="Ödeme sayfan (https://… — Patreon, Shopier, Buy Me a Coffee…)" inputMode="url" />
      <p className="font-body-sm text-outline">Yönetim izni taşıyan roller seçilemez. Dracord ödeme almaz; üyeliği aşağıdan elle ya da kodla verirsin.</p>
      {err ? <p className="font-body-sm text-error">{err}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={cn(btn, 'bg-primary text-on-primary')}>
          {initial ? 'Kaydet' : 'Kademe ekle'}
        </button>
        <button type="button" onClick={onCancel} className={cn(btn, 'bg-surface-container-high text-on-surface')}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}

/** F2 — yönetim: kademeler, aboneler (elle ver/al), kodlar */
export function SubscriptionSettings({
  client,
  guildId,
  roles,
}: {
  client: SubscriptionsClient;
  guildId: string;
  roles: Array<{ id: string; name: string }>;
}) {
  const [tiers, setTiers] = useState<GuildSubscriptionTierDto[] | null>(null);
  const [subs, setSubs] = useState<GuildSubscriptionDto[]>([]);
  const [codes, setCodes] = useState<GuildSubscriptionCodeDto[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [grant, setGrant] = useState<{ q: string; userId: string; tierId: string; days: number | null }>({ q: '', userId: '', tierId: '', days: 30 });
  const [codeForm, setCodeForm] = useState<{ tierId: string; days: number | null; count: number; maxUses: number }>({ tierId: '', days: 30, count: 1, maxUses: 1 });
  const [fresh, setFresh] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [ov, s, c] = await Promise.all([client.getGuildSubscriptions(guildId), client.listGuildSubscribers(guildId), client.listSubscriptionCodes(guildId)]);
    setTiers(ov.tiers);
    setSubs(s);
    setCodes(c);
  }, [client, guildId]);
  useEffect(() => {
    void load().catch((e) => {
      setErr(errText(e));
      setTiers([]);
    });
    void client.getGuildMembers(guildId).then(setMembers).catch(() => undefined);
  }, [client, guildId, load]);

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(errText(e));
    }
  };

  const tierName = useMemo(() => new Map((tiers ?? []).map((t) => [t.id, t.name])), [tiers]);
  const matches = useMemo(() => {
    const q = grant.q.trim().toLowerCase();
    if (!q || grant.userId) return [];
    return members.filter((m) => !m.isBot && (m.username.toLowerCase().includes(q) || (m.displayName ?? '').toLowerCase().includes(q))).slice(0, 6);
  }, [grant.q, grant.userId, members]);

  if (!tiers) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  const firstTier = tiers[0]?.id ?? '';

  return (
    <div className="space-y-space-lg">
      <p className="font-body-sm text-on-surface-variant">
        Üyelerin seni desteklemesi için kademeler tanımla. Ödemeyi kendi sayfandan (Patreon, Shopier, banka vb.) alırsın — Dracord para tahsil
        etmez, komisyon almaz. Ödeme yapan üyeye üyeliği buradan elle ver ya da kod gönder; kademe rolü otomatik verilir, süre dolunca alınır.
      </p>
      {err ? <p className="font-body-sm text-error">{err}</p> : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-label-md text-on-surface">Kademeler</h3>
          {editing === null && tiers.length < SUBSCRIPTION_LIMITS.tiersPerGuild ? (
            <button type="button" onClick={() => setEditing('new')} className={cn(btn, 'bg-primary text-on-primary')}>
              Kademe ekle
            </button>
          ) : null}
        </div>
        {editing === 'new' ? (
          <TierForm roles={roles} onCancel={() => setEditing(null)} onSave={(i) => run(() => client.createSubscriptionTier(guildId, i)).then(() => setEditing(null))} />
        ) : null}
        {tiers.length === 0 && editing !== 'new' ? <p className="font-body-sm text-outline">Henüz kademe yok.</p> : null}
        <ul className="space-y-2">
          {tiers.map((t) =>
            editing === t.id ? (
              <li key={t.id}>
                <TierForm
                  initial={t}
                  roles={roles}
                  onCancel={() => setEditing(null)}
                  onSave={(i) => run(() => client.updateSubscriptionTier(guildId, t.id, i)).then(() => setEditing(null))}
                />
              </li>
            ) : (
              <li key={t.id} className="flex items-center gap-2 rounded-xl bg-surface-container-low px-space-md py-space-sm">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color ?? 'currentColor' }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-label-md text-on-surface">
                    {t.name} {t.priceText ? <span className="text-on-surface-variant">· {t.priceText}</span> : null}
                  </p>
                  <p className="truncate font-body-sm text-outline">
                    {t.subscriberCount ?? 0} abone · {t.roleId ? `rol: ${roles.find((r) => r.id === t.roleId)?.name ?? '—'}` : 'rol yok'}
                    {t.paymentUrl ? ' · ödeme bağlantısı var' : ''}
                  </p>
                </div>
                <button type="button" onClick={() => setEditing(t.id)} className={cn(btn, 'bg-surface-container-high text-on-surface')}>
                  Düzenle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`"${t.name}" silinsin mi? Abonelerin rolü alınır, kodları geçersiz olur.`)) void run(() => client.deleteSubscriptionTier(guildId, t.id));
                  }}
                  className={cn(btn, 'text-error hover:bg-surface-container-high')}
                  aria-label={`${t.name} sil`}
                >
                  Sil
                </button>
              </li>
            ),
          )}
        </ul>
      </section>

      {tiers.length ? (
        <section className="space-y-2">
          <h3 className="font-label-md text-on-surface">Üyelik ver</h3>
          <div className="relative flex flex-wrap gap-2">
            <input
              className={cn(field, 'min-w-[12rem] flex-1')}
              value={grant.q}
              onChange={(e) => setGrant({ ...grant, q: e.target.value, userId: '' })}
              placeholder="Üye ara"
              aria-label="Üye"
            />
            <select className={cn(field, 'w-auto')} value={grant.tierId || firstTier} onChange={(e) => setGrant({ ...grant, tierId: e.target.value })} aria-label="Kademe">
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              className={cn(field, 'w-auto')}
              value={grant.days === null ? '' : String(grant.days)}
              onChange={(e) => setGrant({ ...grant, days: e.target.value ? Number(e.target.value) : null })}
              aria-label="Süre"
            >
              {DURATIONS.map((d) => (
                <option key={d.label} value={d.days === null ? '' : String(d.days)}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!grant.userId}
              onClick={() =>
                void run(() => client.grantGuildSubscription(guildId, { userId: grant.userId, tierId: grant.tierId || firstTier, days: grant.days })).then(() =>
                  setGrant({ ...grant, q: '', userId: '' }),
                )
              }
              className={cn(btn, 'bg-primary text-on-primary')}
            >
              Ver / uzat
            </button>
            {matches.length ? (
              <ul className="absolute left-0 top-full z-10 mt-1 w-64 overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container shadow-lg">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setGrant({ ...grant, q: m.displayName || m.username, userId: m.id })}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-surface-container-high"
                    >
                      <Avatar imageUrl={m.avatarUrl} displayName={m.displayName || m.username} size="sm" />
                      <span className="truncate font-body-sm text-on-surface">{m.displayName || m.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {subs.length ? (
        <section className="space-y-2">
          <h3 className="font-label-md text-on-surface">Aboneler ({subs.length})</h3>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-container-low">
                <Avatar imageUrl={s.avatarUrl ?? null} displayName={s.displayName ?? 'Üye'} size="sm" />
                <span className="min-w-0 flex-1 truncate font-body-sm text-on-surface">
                  {s.displayName ?? 'Üye'} <span className="text-outline">· {tierName.get(s.tierId) ?? '—'} · {until(s.expiresAt)} · {s.source === 'code' ? 'kod' : 'elle'}</span>
                </span>
                <button type="button" onClick={() => void run(() => client.revokeGuildSubscription(guildId, s.id))} className={cn(btn, 'text-error hover:bg-surface-container-high')}>
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tiers.length ? (
        <section className="space-y-2">
          <h3 className="font-label-md text-on-surface">Üyelik kodları</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select className={cn(field, 'w-auto')} value={codeForm.tierId || firstTier} onChange={(e) => setCodeForm({ ...codeForm, tierId: e.target.value })} aria-label="Kademe">
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              className={cn(field, 'w-auto')}
              value={codeForm.days === null ? '' : String(codeForm.days)}
              onChange={(e) => setCodeForm({ ...codeForm, days: e.target.value ? Number(e.target.value) : null })}
              aria-label="Süre"
            >
              {DURATIONS.map((d) => (
                <option key={d.label} value={d.days === null ? '' : String(d.days)}>
                  {d.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 font-label-sm text-on-surface-variant">
              Adet
              <input
                type="number"
                min={1}
                max={SUBSCRIPTION_LIMITS.codesPerBatch}
                value={codeForm.count}
                onChange={(e) => setCodeForm({ ...codeForm, count: Math.max(1, Math.min(SUBSCRIPTION_LIMITS.codesPerBatch, Number(e.target.value) || 1)) })}
                className={cn(field, 'w-20')}
              />
            </label>
            <label className="flex items-center gap-1 font-label-sm text-on-surface-variant">
              Kullanım
              <input
                type="number"
                min={1}
                max={1000}
                value={codeForm.maxUses}
                onChange={(e) => setCodeForm({ ...codeForm, maxUses: Math.max(1, Math.min(1000, Number(e.target.value) || 1)) })}
                className={cn(field, 'w-20')}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  const made = await client.createSubscriptionCodes(guildId, { ...codeForm, tierId: codeForm.tierId || firstTier });
                  setFresh(made.map((c) => c.code));
                })
              }
              className={cn(btn, 'bg-primary text-on-primary')}
            >
              Kod oluştur
            </button>
          </div>
          {fresh.length ? (
            <div className="rounded-lg bg-surface-container-low p-2">
              <pre className="whitespace-pre-wrap font-mono text-sm text-on-surface">{fresh.join('\n')}</pre>
              <button type="button" onClick={() => void navigator.clipboard?.writeText(fresh.join('\n'))} className={cn(btn, 'mt-1 bg-surface-container-high text-on-surface')}>
                Kopyala
              </button>
            </div>
          ) : null}
          {codes.length ? (
            <ul className="max-h-60 space-y-1 overflow-y-auto">
              {codes.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-2 py-0.5 font-body-sm">
                  <code className={cn('font-mono', c.uses >= c.maxUses ? 'text-outline line-through' : 'text-on-surface')}>{c.code}</code>
                  <span className="min-w-0 flex-1 truncate text-outline">
                    {tierName.get(c.tierId) ?? '—'} · {c.days ? `${c.days} gün` : 'süresiz'} · {c.uses}/{c.maxUses}
                  </span>
                  <button type="button" onClick={() => void run(() => client.deleteSubscriptionCode(guildId, c.id))} className="text-outline hover:text-error" aria-label="Kodu sil">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
