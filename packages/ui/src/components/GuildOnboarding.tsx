'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  GuildOnboardingCompleteResult,
  GuildOnboardingConfig,
  GuildOnboardingDto,
  GuildOnboardingQuestion,
  ReactionRoleDto,
} from '@dracord/types';
import { cn } from '../lib/cn';
import { Modal } from './Modal';

export interface GuildOnboardingClient {
  getGuildOnboarding(guildId: string): Promise<GuildOnboardingDto>;
  updateGuildOnboarding(guildId: string, cfg: GuildOnboardingConfig): Promise<GuildOnboardingDto>;
  completeGuildOnboarding(
    guildId: string,
    body: { acceptRules: boolean; answers: Record<string, string[]> },
  ): Promise<GuildOnboardingCompleteResult>;
}

export interface ReactionRolesClient {
  listReactionRoles(guildId: string): Promise<ReactionRoleDto[]>;
  addReactionRole(guildId: string, body: { messageId: string; emoji: string; roleId: string }): Promise<ReactionRoleDto>;
  removeReactionRole(guildId: string, id: string): Promise<{ ok: true }>;
}

interface NamedRef {
  id: string;
  name: string;
}
interface RoleRef extends NamedRef {
  permissions?: string[];
}

/** what a member may give themselves (mirrors the API check) */
const SAFE_PERMS = new Set(['VIEW_CHANNELS', 'SEND_MESSAGES', 'CREATE_POLLS', 'ADD_REACTIONS']);
export const isSelfAssignableRole = (r: RoleRef): boolean =>
  r.name !== '@everyone' && (r.permissions ?? []).every((p) => SAFE_PERMS.has(p));

const field =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';
const rid = () => Math.random().toString(36).slice(2, 10);

// ── member: the screen on joining ──

/**
 * B5 — shown once when a member opens a server whose onboarding is on:
 * accept the rules → answer the questions → roles + suggested channels.
 */
export function GuildOnboardingModal({
  client,
  guildId,
  guildName,
  channelName,
  onDone,
}: {
  client: GuildOnboardingClient;
  guildId: string;
  guildName: string;
  channelName?: (id: string) => string | undefined;
  /** after finishing (or the screen was not needed); the first suggested channel can be opened */
  onDone?: (result: GuildOnboardingCompleteResult | null) => void;
}) {
  const [cfg, setCfg] = useState<GuildOnboardingDto | null>(null);
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuildOnboardingCompleteResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let off = false;
    setCfg(null);
    setStep(0);
    setAccepted(false);
    setAnswers({});
    setResult(null);
    setDismissed(false);
    client
      .getGuildOnboarding(guildId)
      .then((c) => !off && setCfg(c))
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [client, guildId]);

  const steps = useMemo(() => {
    if (!cfg) return [] as Array<{ kind: 'rules' } | { kind: 'q'; q: GuildOnboardingQuestion }>;
    return [
      ...(cfg.rules.length ? [{ kind: 'rules' as const }] : []),
      ...cfg.questions.map((q) => ({ kind: 'q' as const, q })),
    ];
  }, [cfg]);

  if (!cfg || !cfg.enabled || cfg.completed || dismissed || steps.length === 0) return null;
  const cur = steps[Math.min(step, steps.length - 1)]!;
  const last = step >= steps.length - 1;
  const canNext = cur.kind === 'rules' ? accepted : !cur.q.required || (answers[cur.q.id]?.length ?? 0) > 0;

  const toggle = (q: GuildOnboardingQuestion, optId: string) => {
    setAnswers((prev) => {
      const had = prev[q.id] ?? [];
      const next = had.includes(optId) ? had.filter((x) => x !== optId) : q.multi ? [...had, optId] : [optId];
      return { ...prev, [q.id]: next };
    });
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await client.completeGuildOnboarding(guildId, { acceptRules: accepted || cfg.rules.length === 0, answers });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const names = result.suggestedChannelIds.map((id) => channelName?.(id)).filter(Boolean);
    return (
      <Modal
        open
        title={`${guildName} sunucusuna hoş geldin`}
        onClose={() => {
          setDismissed(true);
          onDone?.(result);
        }}
        footer={
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md"
            onClick={() => {
              setDismissed(true);
              onDone?.(result);
            }}
          >
            {names.length ? `#${names[0]} kanalına git` : 'Başla'}
          </button>
        }
      >
        <p className="font-body-md text-on-surface-variant">
          {result.grantedRoleIds.length ? `${result.grantedRoleIds.length} rol verildi. ` : ''}
          {names.length ? `Sana uygun kanallar: ${names.map((n) => `#${n}`).join(', ')}.` : 'Hazırsın!'}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={cur.kind === 'rules' ? `${guildName} — kurallar` : cur.q.title}
      onClose={() => setDismissed(true)}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="font-label-sm text-outline mr-auto">
            {step + 1} / {steps.length}
          </span>
          {step > 0 ? (
            <button type="button" className="px-3 py-2 rounded-lg bg-surface-container-high font-label-md" onClick={() => setStep(step - 1)}>
              Geri
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canNext || busy}
            className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50"
            onClick={() => (last ? void finish() : setStep(step + 1))}
          >
            {last ? (busy ? 'Kaydediliyor…' : 'Bitir') : 'İleri'}
          </button>
        </div>
      }
    >
      {cur.kind === 'rules' ? (
        <div className="space-y-3">
          <ol className="list-decimal pl-5 space-y-1.5 font-body-md text-on-surface">
            {cfg.rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
          <label className="flex items-center gap-2 font-body-md text-on-surface cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-primary-container" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            Kuralları okudum ve kabul ediyorum
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-body-sm text-on-surface-variant">
            {cur.q.multi ? 'Birden fazla seçebilirsin.' : 'Birini seç.'}
            {cur.q.required ? '' : ' İstersen geçebilirsin.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cur.q.options.map((o) => {
              const on = (answers[cur.q.id] ?? []).includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(cur.q, o.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    on ? 'border-primary bg-primary-container/15' : 'border-outline-variant hover:border-primary',
                  )}
                >
                  {o.emoji ? <span className="text-lg">{o.emoji}</span> : null}
                  <span className="font-body-md text-on-surface">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {error ? <p className="mt-2 font-body-sm text-error">{error}</p> : null}
    </Modal>
  );
}

// ── settings: the editor ──

function PickList({
  items,
  value,
  onChange,
  prefix = '',
  empty,
}: {
  items: NamedRef[];
  value: string[];
  onChange: (v: string[]) => void;
  prefix?: string;
  empty: string;
}) {
  if (items.length === 0) return <p className="font-body-sm text-outline">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = value.includes(it.id);
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== it.id) : [...value, it.id])}
            className={cn(
              'rounded-full border px-2.5 py-1 font-label-sm',
              on ? 'border-primary bg-primary-container/20 text-on-surface' : 'border-outline-variant text-on-surface-variant hover:border-primary',
            )}
          >
            {prefix}
            {it.name}
          </button>
        );
      })}
    </div>
  );
}

/** B5 — server settings: rules, questions → roles / channels */
export function GuildOnboardingSettings({
  client,
  guildId,
  roles,
  channels,
}: {
  client: GuildOnboardingClient;
  guildId: string;
  roles: RoleRef[];
  channels: NamedRef[];
}) {
  const [cfg, setCfg] = useState<GuildOnboardingConfig | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const safeRoles = useMemo(() => roles.filter(isSelfAssignableRole), [roles]);

  useEffect(() => {
    void client.getGuildOnboarding(guildId).then((c) => {
      const base: GuildOnboardingConfig = { enabled: c.enabled, rules: c.rules, questions: c.questions, defaultChannelIds: c.defaultChannelIds };
      setCfg(base);
      setSaved(JSON.stringify(base));
    });
  }, [client, guildId]);

  if (!cfg) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  const dirty = JSON.stringify(cfg) !== saved;
  const setQ = (id: string, p: Partial<GuildOnboardingQuestion>) =>
    setCfg({ ...cfg, questions: cfg.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) });

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await client.updateGuildOnboarding(guildId, cfg);
      const base: GuildOnboardingConfig = { enabled: r.enabled, rules: r.rules, questions: r.questions, defaultChannelIds: r.defaultChannelIds };
      setCfg(base);
      setSaved(JSON.stringify(base));
      setMsg({ ok: true, text: 'Kaydedildi' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Kaydedilemedi' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-space-md">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-primary-container" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
        <span>
          <span className="block font-body-md text-on-surface">Katılış ekranı açık</span>
          <span className="block font-body-sm text-on-surface-variant">
            Yeni üyeler sunucuyu ilk açtığında kuralları kabul eder ve sorulara göre rol ve kanal önerisi alır.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <h3 className="font-label-sm uppercase tracking-wider text-outline">Kurallar</h3>
        {cfg.rules.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={field}
              value={r}
              maxLength={300}
              onChange={(e) => setCfg({ ...cfg, rules: cfg.rules.map((x, j) => (j === i ? e.target.value : x)) })}
              placeholder={`Kural ${i + 1}`}
            />
            <button type="button" aria-label="Kuralı sil" className="px-2 text-on-surface-variant hover:text-error" onClick={() => setCfg({ ...cfg, rules: cfg.rules.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        {cfg.rules.length < 10 ? (
          <button type="button" className="font-label-sm text-primary" onClick={() => setCfg({ ...cfg, rules: [...cfg.rules, ''] })}>
            + Kural ekle
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="font-label-sm uppercase tracking-wider text-outline">Herkese önerilen kanallar</h3>
        <PickList items={channels} value={cfg.defaultChannelIds} prefix="#" empty="Metin kanalı yok" onChange={(defaultChannelIds) => setCfg({ ...cfg, defaultChannelIds })} />
      </div>

      <div className="space-y-3">
        <h3 className="font-label-sm uppercase tracking-wider text-outline">Sorular</h3>
        {cfg.questions.map((q) => (
          <div key={q.id} className="rounded-xl bg-surface-container-low p-3 space-y-2">
            <div className="flex gap-2">
              <input className={field} value={q.title} maxLength={120} placeholder="Soru (ör. Hangi oyunları oynarsın?)" onChange={(e) => setQ(q.id, { title: e.target.value })} />
              <button type="button" aria-label="Soruyu sil" className="px-2 text-on-surface-variant hover:text-error" onClick={() => setCfg({ ...cfg, questions: cfg.questions.filter((x) => x.id !== q.id) })}>
                ✕
              </button>
            </div>
            <div className="flex gap-4 font-body-sm text-on-surface-variant">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-primary-container" checked={q.multi} onChange={(e) => setQ(q.id, { multi: e.target.checked })} />
                Çoklu seçim
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-primary-container" checked={q.required} onChange={(e) => setQ(q.id, { required: e.target.checked })} />
                Zorunlu
              </label>
            </div>
            {q.options.map((o) => {
              const setO = (p: Partial<typeof o>) => setQ(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, ...p } : x)) });
              return (
                <div key={o.id} className="rounded-lg border border-outline-variant/50 p-2 space-y-2">
                  <div className="flex gap-2">
                    <input className={cn(field, 'w-16 text-center')} value={o.emoji ?? ''} maxLength={8} placeholder="🎮" onChange={(e) => setO({ emoji: e.target.value || null })} aria-label="Emoji" />
                    <input className={field} value={o.label} maxLength={80} placeholder="Seçenek" onChange={(e) => setO({ label: e.target.value })} />
                    <button type="button" aria-label="Seçeneği sil" className="px-2 text-on-surface-variant hover:text-error" onClick={() => setQ(q.id, { options: q.options.filter((x) => x.id !== o.id) })}>
                      ✕
                    </button>
                  </div>
                  <p className="font-label-sm text-outline">Verilecek roller</p>
                  <PickList items={safeRoles} value={o.roleIds} empty="Yönetim izni olmayan bir rol oluştur" onChange={(roleIds) => setO({ roleIds })} />
                  <p className="font-label-sm text-outline">Önerilecek kanallar</p>
                  <PickList items={channels} value={o.channelIds} prefix="#" empty="Metin kanalı yok" onChange={(channelIds) => setO({ channelIds })} />
                </div>
              );
            })}
            {q.options.length < 12 ? (
              <button
                type="button"
                className="font-label-sm text-primary"
                onClick={() => setQ(q.id, { options: [...q.options, { id: rid(), label: '', emoji: null, roleIds: [], channelIds: [] }] })}
              >
                + Seçenek ekle
              </button>
            ) : null}
          </div>
        ))}
        {cfg.questions.length < 8 ? (
          <button
            type="button"
            className="font-label-sm text-primary"
            onClick={() =>
              setCfg({ ...cfg, questions: [...cfg.questions, { id: rid(), title: '', multi: true, required: false, options: [{ id: rid(), label: '', emoji: null, roleIds: [], channelIds: [] }] }] })
            }
          >
            + Soru ekle
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => void save()}
          className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50"
        >
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {msg ? <span className={msg.ok ? 'font-body-sm text-dracula-green' : 'font-body-sm text-error'}>{msg.text}</span> : null}
      </div>
    </div>
  );
}

/** "https://dracord.com.tr/channels/g/c/m" or a bare id → message id */
export function parseMessageRef(raw: string): string {
  const t = raw.trim();
  const m = /\/channels\/[^/]+\/[^/]+\/([A-Za-z0-9_-]+)/.exec(t);
  return (m?.[1] ?? t).slice(0, 64);
}

/** B5 — react on a message → get a role */
export function ReactionRolesSettings({
  client,
  guildId,
  roles,
  channels,
}: {
  client: ReactionRolesClient;
  guildId: string;
  roles: RoleRef[];
  channels: NamedRef[];
}) {
  const [rows, setRows] = useState<ReactionRoleDto[] | null>(null);
  const [messageRef, setMessageRef] = useState('');
  const [emoji, setEmoji] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const safeRoles = useMemo(() => roles.filter(isSelfAssignableRole), [roles]);
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? 'silinmiş rol';
  const chName = (id: string) => channels.find((c) => c.id === id)?.name ?? 'kanal';

  useEffect(() => {
    void client
      .listReactionRoles(guildId)
      .then(setRows)
      .catch(() => setRows([]));
  }, [client, guildId]);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const row = await client.addReactionRole(guildId, { messageId: parseMessageRef(messageRef), emoji: emoji.trim(), roleId });
      setRows((r) => [...(r ?? []), row]);
      setMessageRef('');
      setEmoji('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eklenemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-space-md">
      <p className="font-body-sm text-on-surface-variant">
        Bir mesaja seçtiğin emojiyle tepki veren üye rolü alır, tepkisini kaldırınca rol de gider. Mesajın bağlantısını
        mesaj menüsündeki “Bağlantıyı kopyala” ile alabilirsin.
      </p>
      {rows === null ? <p className="font-body-sm text-outline">Yükleniyor…</p> : null}
      {rows && rows.length > 0 ? (
        <ul className="divide-y divide-surface-container-high rounded-xl bg-surface-container-low">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <span className="text-lg">{r.emoji}</span>
              <span className="min-w-0 flex-1 font-body-sm text-on-surface truncate">
                → <strong>{roleName(r.roleId)}</strong> · #{chName(r.channelId)}
              </span>
              <button
                type="button"
                aria-label="Tepki rolünü kaldır"
                className="px-2 text-on-surface-variant hover:text-error"
                onClick={() => void client.removeReactionRole(guildId, r.id).then(() => setRows((x) => (x ?? []).filter((y) => y.id !== r.id)))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_5rem_1fr_auto] gap-2">
        <input className={field} value={messageRef} onChange={(e) => setMessageRef(e.target.value)} placeholder="Mesaj bağlantısı ya da ID" aria-label="Mesaj" />
        <input className={cn(field, 'text-center')} value={emoji} maxLength={8} onChange={(e) => setEmoji(e.target.value)} placeholder="🎮" aria-label="Emoji" />
        <select className={field} value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-label="Rol">
          <option value="">Rol seç…</option>
          {safeRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !messageRef.trim() || !emoji.trim() || !roleId}
          onClick={() => void add()}
          className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50"
        >
          Ekle
        </button>
      </div>
      {safeRoles.length === 0 ? <p className="font-body-sm text-outline">Önce yönetim izni olmayan bir rol oluştur.</p> : null}
      {error ? <p className="font-body-sm text-error">{error}</p> : null}
    </div>
  );
}
