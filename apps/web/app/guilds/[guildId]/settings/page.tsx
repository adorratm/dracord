'use client';

import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { useGuildNav } from '@/hooks/useGuildNav';
import type { GuildSummary } from '@dracord/types';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

export default function GuildSettingsPage({ params }: PageProps) {
  const { guildId } = use(params);
  const router = useRouter();
  const { client, user } = useAuth();
  const { guilds, guild, channels, patchGuild, reload } = useGuildNav(guildId);
  const [detail, setDetail] = useState<GuildSummary | null>(guild);
  const [nameDraft, setNameDraft] = useState(guild?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    setDetail(guild);
    if (guild?.name) setNameDraft(guild.name);
  }, [guild]);

  useEffect(() => {
    void client
      .getGuildPermissions(guildId)
      .then((p) => {
        const perms = new Set(p.permissions ?? []);
        setCanManage(
          p.owner ||
            perms.has('MANAGE_GUILD') ||
            perms.has('ADMINISTRATOR'),
        );
      })
      .catch(() => setCanManage(false));
  }, [client, guildId, user?.id]);

  useEffect(() => {
    if (!guild && guildId) {
      void client
        .listGuilds()
        .then((list) => {
          const found = list.find((g) => g.id === guildId);
          if (found) {
            setDetail(found);
            setNameDraft(found.name);
          }
        })
        .catch(() => undefined);
    }
  }, [guild, guildId, client]);

  const backToChannels = useCallback(() => {
    const text = channels.find((c) => c.type === 'TEXT');
    if (text) {
      router.push(`/channels/${guildId}/${text.id}`);
      return;
    }
    router.push(`/channels/${guildId}`);
  }, [channels, guildId, router]);

  const save = useCallback(async () => {
    if (!nameDraft.trim()) {
      setError('Sunucu adı boş olamaz');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await client.updateGuild(guildId, { name: nameDraft.trim() });
      patchGuild(updated);
      setDetail(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }, [client, guildId, nameDraft, patchGuild]);

  const uploadImage = useCallback(
    async (file: File, kind: 'icon' | 'banner') => {
      setBusy(true);
      setError(null);
      try {
        const uploaded = await client.uploadFile(file, kind === 'icon' ? 'avatars' : 'banners');
        const updated = await client.updateGuild(
          guildId,
          kind === 'icon' ? { iconUrl: uploaded.url } : { bannerUrl: uploaded.url },
        );
        patchGuild(updated);
        setDetail(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Görsel yüklenemedi');
      } finally {
        setBusy(false);
      }
    },
    [client, guildId, patchGuild],
  );

  return (
    <RequireAuth>
      <AppShell guilds={guilds} activeGuildId={guildId} subtitle="Sunucu ayarları">
        <div className="flex-1 overflow-y-auto bg-surface px-space-xl py-space-xl">
          <button
            type="button"
            className="mb-space-lg text-primary font-body-sm hover:underline"
            onClick={backToChannels}
          >
            ← Kanallara dön
          </button>
          <h1 className="font-headline-xl text-headline-xl text-on-surface mb-space-md">
            {detail?.name ?? 'Sunucu'} — Ayarlar
          </h1>
          {!canManage ? (
            <p className="font-body-md text-on-surface-variant">
              Bu sunucuyu düzenlemek için yetkin yok. Sunucu ID: {guildId}
            </p>
          ) : (
            <div className="max-w-lg space-y-space-lg">
              {error && (
                <p className="font-body-sm text-error bg-error/10 rounded-lg px-space-sm py-space-xs">
                  {error}
                </p>
              )}

              <div className="relative h-28 rounded-xl overflow-hidden bg-surface-container-highest border border-surface-container-high">
                {detail?.bannerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detail.bannerUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-outline font-label-sm">
                    Kapak görseli yok
                  </div>
                )}
                <label className="absolute right-2 bottom-2 h-8 px-space-sm rounded-lg bg-black/60 text-white font-label-sm flex items-center gap-1 cursor-pointer">
                  Kapak
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadImage(file, 'banner');
                    }}
                  />
                </label>
              </div>

              <div className="flex items-center gap-space-md">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-surface-container-highest border border-surface-container-high shrink-0">
                  {detail?.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.iconUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-headline-md">
                      {(nameDraft || 'S').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <label className="h-9 px-space-sm rounded-lg bg-surface-container-highest font-label-sm flex items-center cursor-pointer">
                  İkon değiştir
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadImage(file, 'icon');
                    }}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-space-xs">
                <span className="font-label-sm text-on-surface-variant">Sunucu adı</span>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
                  disabled={busy}
                />
              </label>

              <dl className="grid gap-space-sm">
                <div className="rounded-lg bg-surface-container-low p-space-md">
                  <dt className="font-label-sm text-outline uppercase">Sunucu ID</dt>
                  <dd className="font-body-sm mt-1 break-all">{guildId}</dd>
                </div>
                <div className="rounded-lg bg-surface-container-low p-space-md">
                  <dt className="font-label-sm text-outline uppercase">Sahip ID</dt>
                  <dd className="font-body-sm mt-1 break-all">{detail?.ownerId ?? '—'}</dd>
                </div>
              </dl>

              <button
                type="button"
                disabled={busy || !nameDraft.trim()}
                onClick={() => void save()}
                className="h-10 px-space-md rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
              >
                {busy ? 'Kaydediliyor…' : 'Kaydet'}
              </button>

              <button
                type="button"
                className="font-label-sm text-primary-container hover:underline"
                onClick={() => void reload()}
              >
                Yenile
              </button>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
