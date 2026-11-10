'use client';

import { useEffect, useState } from 'react';
import {
  AUTOMOD_LIMITS,
  AUTOMOD_REASON_TR,
  automodCheckContent,
  isSafeAutomodRegex,
  type AutomodEventDto,
  type AutomodRule,
  type GuildAutomodConfigDto,
} from '@dracord/types';
import { cn } from '../lib/cn';

export type AutomodClient = {
  getAutomodConfig(guildId: string): Promise<GuildAutomodConfigDto>;
  updateAutomodConfig(guildId: string, patch: Partial<Omit<GuildAutomodConfigDto, 'guildId'>>): Promise<GuildAutomodConfigDto>;
  listAutomodEvents(guildId: string, limit?: number): Promise<AutomodEventDto[]>;
};

const field =
  'rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';

function Toggle({ label, desc, checked, onChange, disabled }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn('flex items-start gap-3', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-label-md text-on-surface">{label}</span>
        {desc ? <span className="block font-body-sm text-on-surface-variant">{desc}</span> : null}
      </span>
    </label>
  );
}

function Num({ label, value, min, max, onChange, suffix, disabled }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center justify-between gap-3', disabled && 'opacity-50')}>
      <span className="font-body-sm text-on-surface">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          className={cn(field, 'w-20 py-1 text-right tabular-nums')}
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
        />
        {suffix ? <span className="font-label-sm text-on-surface-variant">{suffix}</span> : null}
      </span>
    </label>
  );
}

/**
 * D2 — sunucu otomatik moderasyon ayarları (web + desktop). Model yok: kurallar + sezgiler.
 */
export function AutomodSettings({
  client,
  guildId,
  roles,
  channels,
}: {
  client: AutomodClient;
  guildId: string;
  roles: Array<{ id: string; name: string }>;
  channels: Array<{ id: string; name: string }>;
}) {
  const [cfg, setCfg] = useState<GuildAutomodConfigDto | null>(null);
  const [saved, setSaved] = useState<GuildAutomodConfigDto | null>(null);
  const [events, setEvents] = useState<AutomodEventDto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newKind, setNewKind] = useState<AutomodRule['kind']>('word');
  const [newPattern, setNewPattern] = useState('');
  const [test, setTest] = useState('');

  useEffect(() => {
    void client.getAutomodConfig(guildId).then((c) => {
      setCfg(c);
      setSaved(c);
    });
    void client.listAutomodEvents(guildId, 50).then(setEvents).catch(() => setEvents([]));
  }, [client, guildId]);

  if (!cfg) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const on = cfg.enabled;
  const set = (p: Partial<GuildAutomodConfigDto>) => setCfg({ ...cfg, ...p });
  const setSpam = (p: Partial<GuildAutomodConfigDto['spam']>) => setCfg({ ...cfg, spam: { ...cfg.spam, ...p } });
  const setTo = (p: Partial<GuildAutomodConfigDto['timeout']>) => setCfg({ ...cfg, timeout: { ...cfg.timeout, ...p } });
  const newInvalid = newKind === 'regex' && newPattern.trim() !== '' && !isSafeAutomodRegex(newPattern.trim());
  const testHit = test.trim() ? automodCheckContent(test, cfg) : null;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { guildId: _g, ...patch } = cfg;
      const c = await client.updateAutomodConfig(guildId, patch);
      setCfg(c);
      setSaved(c);
      setMsg({ ok: true, text: 'Kaydedildi.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi' });
    } finally {
      setBusy(false);
    }
  };

  const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(0, AUTOMOD_LIMITS.exempt));

  return (
    <div className="space-y-space-lg">
      <Toggle
        label="Otomatik moderasyonu aç"
        desc="Kurallara uymayan mesajlar gönderilmeden engellenir; kişiye nedeni söylenir. Mesajları yönetebilen üyeler muaftır."
        checked={on}
        onChange={(v) => set({ enabled: v })}
      />

      <section className={cn('space-y-2', !on && 'opacity-60')}>
        <h4 className="font-label-md text-on-surface">Yasaklı kelime ve kalıplar</h4>
        <p className="font-body-sm text-on-surface-variant">
          Kelimeler büyük/küçük harf, Türkçe karakter, araya nokta/boşluk koyma ve rakamla yazma (s.4.l.a.k) hilelerine karşı eşleşir; kelimenin
          parçası olarak geçenler (ör. &ldquo;class&rdquo; içindeki &ldquo;ass&rdquo;) yakalanmaz.
        </p>
        <div className="flex flex-wrap gap-2">
          <select className={cn(field, 'w-auto')} value={newKind} onChange={(e) => setNewKind(e.target.value as AutomodRule['kind'])} aria-label="Kural türü">
            <option value="word">Kelime / ifade</option>
            <option value="regex">Düzenli ifade</option>
          </select>
          <input
            className={cn(field, 'min-w-[12rem] flex-1', newInvalid && 'border-error')}
            value={newPattern}
            maxLength={AUTOMOD_LIMITS.patternMax}
            onChange={(e) => setNewPattern(e.target.value)}
            placeholder={newKind === 'word' ? 'ör. kumar sitesi' : 'ör. b[e3]t\\d{3}'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newPattern.trim() && !newInvalid) {
                e.preventDefault();
                set({ rules: [...cfg.rules, { id: `n${Date.now()}`, kind: newKind, pattern: newPattern.trim() }].slice(0, AUTOMOD_LIMITS.rules) });
                setNewPattern('');
              }
            }}
          />
          <button
            type="button"
            disabled={!newPattern.trim() || newInvalid || cfg.rules.length >= AUTOMOD_LIMITS.rules}
            onClick={() => {
              set({ rules: [...cfg.rules, { id: `n${Date.now()}`, kind: newKind, pattern: newPattern.trim() }] });
              setNewPattern('');
            }}
            className="rounded-lg bg-surface-container-high px-3 py-2 font-label-md text-on-surface disabled:opacity-50"
          >
            Ekle
          </button>
        </div>
        {newInvalid ? <p className="font-label-sm text-error">Geçersiz ya da yavaşlatabilecek düzenli ifade (iç içe tekrar, geri başvuru).</p> : null}
        {cfg.rules.length ? (
          <ul className="flex flex-wrap gap-2">
            {cfg.rules.map((r) => (
              <li key={r.id} className="flex items-center gap-1 rounded-lg bg-surface-container-high py-1 pl-2 pr-1 font-body-sm text-on-surface">
                {r.kind === 'regex' ? <code className="text-on-surface-variant">/{r.pattern}/</code> : r.pattern}
                <button type="button" onClick={() => set({ rules: cfg.rules.filter((x) => x.id !== r.id) })} className="text-outline hover:text-error" aria-label={`${r.pattern} kaldır`}>
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body-sm text-outline">Henüz kural yok.</p>
        )}
      </section>

      <section className={cn('space-y-2', !on && 'opacity-60')}>
        <h4 className="font-label-md text-on-surface">Spam koruması</h4>
        <Toggle label="Spam sezgileri" checked={cfg.spam.enabled} onChange={(v) => setSpam({ enabled: v })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Num label="10 sn'de en fazla mesaj" value={cfg.spam.maxPerTenSeconds} min={0} max={60} onChange={(v) => setSpam({ maxPerTenSeconds: v })} disabled={!cfg.spam.enabled} />
          <Num label="30 sn'de aynı mesaj" value={cfg.spam.maxDuplicates} min={0} max={20} onChange={(v) => setSpam({ maxDuplicates: v })} disabled={!cfg.spam.enabled} />
          <Num label="En fazla etiket" value={cfg.spam.maxMentions} min={0} max={50} onChange={(v) => setSpam({ maxMentions: v })} disabled={!cfg.spam.enabled} />
          <Num label="En fazla bağlantı" value={cfg.spam.maxLinks} min={0} max={50} onChange={(v) => setSpam({ maxLinks: v })} disabled={!cfg.spam.enabled} />
          <Num
            label="Büyük harf sınırı"
            value={Math.round(cfg.spam.capsRatio * 100)}
            min={50}
            max={100}
            suffix="%"
            onChange={(v) => setSpam({ capsRatio: v / 100 })}
            disabled={!cfg.spam.enabled}
          />
        </div>
        <p className="font-label-sm text-outline">0 = o kontrol kapalı. Büyük harf %100 = kapalı.</p>
        <Toggle label="Başka sunucu davetlerini engelle" desc="Kendi özel adresine giden davet serbest." checked={cfg.spam.blockInvites} onChange={(v) => setSpam({ blockInvites: v })} disabled={!cfg.spam.enabled} />
        <Toggle label="Bozuk (zalgo) metni engelle" checked={cfg.spam.blockZalgo} onChange={(v) => setSpam({ blockZalgo: v })} disabled={!cfg.spam.enabled} />
      </section>

      <section className={cn('space-y-2', !on && 'opacity-60')}>
        <h4 className="font-label-md text-on-surface">Tekrarlayan ihlal</h4>
        <Toggle label="Otomatik zaman aşımı" checked={cfg.timeout.enabled} onChange={(v) => setTo({ enabled: v })} />
        <div className="grid gap-2 sm:grid-cols-3">
          <Num label="İhlal sayısı" value={cfg.timeout.violations} min={1} max={20} onChange={(v) => setTo({ violations: v })} disabled={!cfg.timeout.enabled} />
          <Num label="Süre içinde" value={cfg.timeout.windowMinutes} min={1} max={120} suffix="dk" onChange={(v) => setTo({ windowMinutes: v })} disabled={!cfg.timeout.enabled} />
          <Num label="Susturma" value={cfg.timeout.minutes} min={1} max={10080} suffix="dk" onChange={(v) => setTo({ minutes: v })} disabled={!cfg.timeout.enabled} />
        </div>
      </section>

      <section className={cn('space-y-2', !on && 'opacity-60')}>
        <h4 className="font-label-md text-on-surface">Muafiyetler</h4>
        <p className="font-body-sm text-on-surface-variant">Seçili rollerdeki üyeler ve seçili kanallar kontrol edilmez.</p>
        <div className="flex flex-wrap gap-1.5">
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => set({ exemptRoleIds: toggleId(cfg.exemptRoleIds, r.id) })}
              className={cn('rounded-full px-2.5 py-1 font-label-sm', cfg.exemptRoleIds.includes(r.id) ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface')}
            >
              @{r.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => set({ exemptChannelIds: toggleId(cfg.exemptChannelIds, c.id) })}
              className={cn('rounded-full px-2.5 py-1 font-label-sm', cfg.exemptChannelIds.includes(c.id) ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface')}
            >
              #{c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-1">
        <h4 className="font-label-md text-on-surface">Dene</h4>
        <input className={cn(field, 'w-full')} value={test} onChange={(e) => setTest(e.target.value)} placeholder="Örnek mesaj yaz — kaydetmeden önce kuralları sına" />
        {test.trim() ? (
          <p className={cn('font-body-sm', testHit ? 'text-error' : 'text-on-surface-variant')}>
            {testHit ? `Engellenir: ${AUTOMOD_REASON_TR[testHit.reason]}${testHit.detail ? ` (${testHit.detail})` : ''}` : 'Geçer (hız/tekrar kontrolleri gerçek gönderimde yapılır).'}
          </p>
        ) : null}
      </section>

      <div className="flex items-center gap-2">
        <button type="button" disabled={!dirty || busy} onClick={() => void save()} className="rounded-lg bg-primary px-4 py-2 font-label-md text-on-primary disabled:opacity-50">
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {msg ? <span className={cn('font-body-sm', msg.ok ? 'text-on-surface-variant' : 'text-error')}>{msg.text}</span> : null}
      </div>

      <section className="space-y-2">
        <h4 className="font-label-md text-on-surface">Son engellenenler</h4>
        {events === null ? <p className="font-body-sm text-outline">Yükleniyor…</p> : null}
        {events?.length === 0 ? <p className="font-body-sm text-outline">Kayıt yok.</p> : null}
        <ul className="divide-y divide-outline-variant/30 rounded-xl bg-surface-container-low">
          {(events ?? []).map((e) => (
            <li key={e.id} className="px-space-sm py-1.5">
              <div className="flex flex-wrap items-center gap-2 font-label-sm">
                <span className="text-on-surface">{e.userName}</span>
                <span className="text-on-surface-variant">{AUTOMOD_REASON_TR[e.reason]}</span>
                {e.action === 'timeout' ? <span className="rounded bg-error/15 px-1 text-error">susturuldu</span> : null}
                <span className="ml-auto text-outline">{new Date(e.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <p className="truncate font-body-sm text-on-surface-variant">{e.preview}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
