'use client';

import { useEffect, useState } from 'react';
import { VANITY_LIMITS, normalizeVanityCode, type GuildSummary } from '@dracord/types';
import { cn } from '../lib/cn';

export type GuildPublicPageClient = {
  updateGuild(
    guildId: string,
    data: { vanityCode?: string | null; publicPage?: boolean; publicDescription?: string | null },
  ): Promise<GuildSummary>;
};

/**
 * B3 — özel adres (vanity) + herkese açık tanıtım sayfası ayarı. Web + desktop.
 * `openExternal` desktop'ta tarayıcıda açmak için (yoksa yeni sekme).
 */
export function GuildPublicPageSettings({
  client,
  guild,
  onSaved,
  siteUrl = 'https://dracord.com.tr',
  openExternal,
}: {
  client: GuildPublicPageClient;
  guild: GuildSummary;
  onSaved?: (g: GuildSummary) => void;
  siteUrl?: string;
  openExternal?: (url: string) => void;
}) {
  const [code, setCode] = useState(guild.vanityCode ?? '');
  const [desc, setDesc] = useState(guild.publicDescription ?? '');
  const [pub, setPub] = useState(Boolean(guild.publicPage));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCode(guild.vanityCode ?? '');
    setDesc(guild.publicDescription ?? '');
    setPub(Boolean(guild.publicPage));
  }, [guild.id, guild.vanityCode, guild.publicDescription, guild.publicPage]);

  const normalized = code.trim() ? normalizeVanityCode(code) : null;
  const invalid = Boolean(code.trim()) && !normalized;
  const dirty =
    (normalized ?? '') !== (guild.vanityCode ?? '') ||
    desc.trim() !== (guild.publicDescription ?? '') ||
    pub !== Boolean(guild.publicPage);
  const base = siteUrl.replace(/\/$/, '');
  const live = guild.vanityCode ? `${base}/s/${guild.vanityCode}` : null;
  const invite = guild.vanityCode ? `${base}/invite/${guild.vanityCode}` : null;

  const save = async () => {
    if (invalid) return;
    setBusy(true);
    setMsg(null);
    try {
      const g = await client.updateGuild(guild.id, {
        vanityCode: normalized,
        publicDescription: desc.trim() || null,
        publicPage: normalized ? pub : false,
      });
      onSaved?.(g);
      setMsg({ ok: true, text: 'Kaydedildi.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi' });
    } finally {
      setBusy(false);
    }
  };

  const open = (url: string) => (openExternal ? openExternal(url) : window.open(url, '_blank', 'noopener,noreferrer'));

  return (
    <div className="space-y-space-md">
      <label className="block space-y-1">
        <span className="font-label-md text-on-surface">Özel adres</span>
        <div className="flex items-stretch overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-container-low focus-within:border-primary">
          <span className="flex items-center px-3 font-body-sm text-on-surface-variant bg-surface-container-high whitespace-nowrap">
            {base.replace(/^https?:\/\//, '')}/s/
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={VANITY_LIMITS.max + 4}
            placeholder="sunucu-adi"
            spellCheck={false}
            autoCapitalize="none"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 font-body-md text-on-surface outline-none"
          />
        </div>
        <span className={cn('font-label-sm', invalid ? 'text-error' : 'text-outline')}>
          {invalid
            ? `${VANITY_LIMITS.min}–${VANITY_LIMITS.max} karakter; a-z, 0-9 ve tire. Ayrılmış kelimeler kullanılamaz.`
            : normalized && normalized !== code.trim()
              ? `Şöyle kaydedilecek: ${normalized}`
              : 'Bu adres aynı zamanda süresiz davet bağlantısıdır.'}
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={pub && Boolean(normalized)}
          disabled={!normalized}
          onChange={(e) => setPub(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
        />
        <span>
          <span className="block font-label-md text-on-surface">Tanıtım sayfasını herkese aç</span>
          <span className="block font-body-sm text-on-surface-variant">
            Giriş yapmamış kişiler de sunucu adını, açıklamayı, üye sayısını ve açık metin kanallarının adlarını görür.
            Mesajlar asla görünmez.
          </span>
        </span>
      </label>

      <label className="block space-y-1">
        <span className="font-label-md text-on-surface">Tanıtım metni</span>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value.slice(0, VANITY_LIMITS.descMax))}
          rows={4}
          placeholder="Sunucun ne hakkında? Kimler katılmalı?"
          className="w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary"
        />
        <span className="font-label-sm text-outline">
          {desc.length}/{VANITY_LIMITS.descMax}
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!dirty || invalid || busy}
          onClick={() => void save()}
          className="rounded-lg bg-primary px-4 py-2 font-label-md text-on-primary disabled:opacity-50"
        >
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {live && guild.publicPage ? (
          <button
            type="button"
            onClick={() => open(live)}
            className="rounded-lg bg-surface-container-high px-3 py-2 font-label-md text-on-surface hover:bg-surface-bright"
          >
            Sayfayı aç
          </button>
        ) : null}
        {invite ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(invite).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="rounded-lg bg-surface-container-high px-3 py-2 font-label-md text-on-surface hover:bg-surface-bright"
          >
            {copied ? 'Kopyalandı' : 'Davet bağlantısını kopyala'}
          </button>
        ) : null}
        {msg ? <span className={cn('font-body-sm', msg.ok ? 'text-on-surface-variant' : 'text-error')}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
