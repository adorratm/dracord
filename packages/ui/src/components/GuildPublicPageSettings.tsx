'use client';

import { useEffect, useState } from 'react';
import {
  GUILD_BADGE_LIMITS,
  VANITY_LIMITS,
  normalizeBadgeEmoji,
  normalizeBadgeTag,
  normalizeVanityCode,
  type GuildSummary,
} from '@dracord/types';
import { GuildBadgeChip } from './GuildBadge';
import { cn } from '../lib/cn';

export type GuildPublicPageClient = {
  updateGuild(
    guildId: string,
    data: {
      vanityCode?: string | null;
      publicPage?: boolean;
      publicDescription?: string | null;
      badgeTag?: string | null;
      badgeEmoji?: string | null;
    },
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
  const [tag, setTag] = useState(guild.badgeTag ?? '');
  const [emoji, setEmoji] = useState(guild.badgeEmoji ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCode(guild.vanityCode ?? '');
    setDesc(guild.publicDescription ?? '');
    setPub(Boolean(guild.publicPage));
    setTag(guild.badgeTag ?? '');
    setEmoji(guild.badgeEmoji ?? '');
  }, [guild.id, guild.vanityCode, guild.publicDescription, guild.publicPage, guild.badgeTag, guild.badgeEmoji]);

  const normalized = code.trim() ? normalizeVanityCode(code) : null;
  const invalid = Boolean(code.trim()) && !normalized;
  const tagNorm = tag.trim() ? normalizeBadgeTag(tag) : null;
  const tagInvalid = Boolean(tag.trim()) && !tagNorm;
  const emojiNorm = normalizeBadgeEmoji(emoji);
  const emojiInvalid = Boolean(emoji.trim()) && !emojiNorm;
  const dirty =
    (tagNorm ?? '') !== (guild.badgeTag ?? '') ||
    (emojiNorm ?? '') !== (guild.badgeEmoji ?? '') ||
    (normalized ?? '') !== (guild.vanityCode ?? '') ||
    desc.trim() !== (guild.publicDescription ?? '') ||
    pub !== Boolean(guild.publicPage);
  const base = siteUrl.replace(/\/$/, '');
  const live = guild.vanityCode ? `${base}/s/${guild.vanityCode}` : null;
  const invite = guild.vanityCode ? `${base}/invite/${guild.vanityCode}` : null;

  const save = async () => {
    if (invalid || tagInvalid || emojiInvalid) return;
    setBusy(true);
    setMsg(null);
    try {
      const g = await client.updateGuild(guild.id, {
        vanityCode: normalized,
        publicDescription: desc.trim() || null,
        publicPage: normalized ? pub : false,
        badgeTag: tagNorm,
        badgeEmoji: emojiNorm,
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

      <fieldset className="space-y-2 rounded-lg border border-outline-variant/40 p-space-md">
        <legend className="px-1 font-label-md text-on-surface">Sunucu rozeti</legend>
        <p className="font-body-sm text-on-surface-variant">
          Üyeler bu rozeti profillerinde gösterebilir (Ayarlar › Profil). Kısa bir etiket ve isteğe bağlı bir emoji seç.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block font-label-sm text-on-surface-variant">Emoji</span>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={GUILD_BADGE_LIMITS.emojiMax}
              placeholder="🐉"
              className="w-16 rounded-lg border border-outline-variant/60 bg-surface-container-low px-2 py-2 text-center font-body-md text-on-surface outline-none focus:border-primary"
            />
          </label>
          <label className="space-y-1">
            <span className="block font-label-sm text-on-surface-variant">Etiket</span>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              maxLength={GUILD_BADGE_LIMITS.tagMax + 2}
              placeholder="TAG"
              spellCheck={false}
              className="w-28 rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md uppercase tracking-wide text-on-surface outline-none focus:border-primary"
            />
          </label>
          {tagNorm ? (
            <div className="pb-2">
              <GuildBadgeChip badge={{ name: guild.name, iconUrl: guild.iconUrl, tag: tagNorm, emoji: emojiNorm }} />
            </div>
          ) : null}
        </div>
        {tagInvalid || emojiInvalid ? (
          <p className="font-label-sm text-error">
            {tagInvalid
              ? `Etiket ${GUILD_BADGE_LIMITS.tagMin}–${GUILD_BADGE_LIMITS.tagMax} harf/rakam olmalı.`
              : 'Simge tek bir emoji olmalı.'}
          </p>
        ) : (
          <p className="font-label-sm text-outline">Etiketi boşaltırsan rozet kapanır ve profillerden kalkar.</p>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!dirty || invalid || tagInvalid || emojiInvalid || busy}
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
