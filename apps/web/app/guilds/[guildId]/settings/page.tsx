'use client';

import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { useGuildNav } from '@/hooks/useGuildNav';
import type { GuildSummary, RoleBadgeKey, RoleDto, RoleProfileBgKey } from '@dracord/types';
import { RoleBadge } from '@dracord/ui';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

const BADGE_OPTIONS: { id: RoleBadgeKey; label: string }[] = [
  { id: 'none', label: 'Rozet yok' },
  { id: 'crown', label: 'Taç' },
  { id: 'shield', label: 'Kalkan' },
  { id: 'star', label: 'Yıldız' },
  { id: 'fire', label: 'Ateş' },
  { id: 'sparkle', label: 'Parıltı' },
  { id: 'diamond', label: 'Elmas' },
  { id: 'heart', label: 'Kalp' },
];

const BG_OPTIONS: { id: RoleProfileBgKey; label: string }[] = [
  { id: 'none', label: 'Varsayılan' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'ember', label: 'Kor' },
  { id: 'ocean', label: 'Okyanus' },
  { id: 'noir', label: 'Noir' },
  { id: 'candy', label: 'Candy' },
  { id: 'mint', label: 'Mint' },
  { id: 'sunset', label: 'Gün batımı' },
];

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
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#5865F2');
  const [newBadge, setNewBadge] = useState<RoleBadgeKey>('star');
  const [newBg, setNewBg] = useState<RoleProfileBgKey>('aurora');

  const loadRoles = useCallback(async () => {
    try {
      const list = await client.listGuildRoles(guildId);
      setRoles(list.sort((a, b) => b.position - a.position));
    } catch {
      setRoles([]);
    }
  }, [client, guildId]);

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
        setCanManageRoles(
          p.owner || perms.has('MANAGE_ROLES') || perms.has('ADMINISTRATOR'),
        );
      })
      .catch(() => {
        setCanManage(false);
        setCanManageRoles(false);
      });
  }, [client, guildId, user?.id]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

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

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await client.createGuildRole(guildId, {
        name: newRoleName.trim(),
        color: newRoleColor,
        badgeKey: newBadge,
        profileBgKey: newBg,
        hoist: true,
        permissions: ['VIEW_CHANNELS', 'SEND_MESSAGES', 'ADD_REACTIONS'],
      });
      setNewRoleName('');
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rol oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  const patchRole = async (role: RoleDto, patch: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await client.updateGuildRole(guildId, role.id, patch);
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rol güncellenemedi');
    } finally {
      setBusy(false);
    }
  };

  const removeRole = async (role: RoleDto) => {
    if (role.name === '@everyone') return;
    setBusy(true);
    try {
      await client.deleteGuildRole(guildId, role.id);
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rol silinemedi');
    } finally {
      setBusy(false);
    }
  };

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

          <section className="max-w-2xl mt-space-2xl">
            <h2 className="font-headline-lg text-on-surface mb-space-sm">Roller & rozetler</h2>
            <p className="font-body-sm text-on-surface-variant mb-space-md">
              Animasyonlu rozet ve profil arka planı rol bazlıdır. Üye listesinde sağ tık → rol ver.
            </p>
            {!canManageRoles ? (
              <p className="font-body-sm text-outline">Rol yönetmek için yetkin yok.</p>
            ) : (
              <>
                <div className="rounded-xl border border-surface-container-highest bg-surface-container-low p-space-md mb-space-lg space-y-space-sm">
                  <p className="font-label-sm text-outline uppercase tracking-wider">Yeni rol</p>
                  <div className="flex flex-wrap gap-space-sm items-center">
                    <input
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="Rol adı"
                      className="h-9 px-space-sm rounded-lg bg-surface-container-highest outline-none flex-1 min-w-[8rem]"
                    />
                    <input
                      type="color"
                      value={newRoleColor}
                      onChange={(e) => setNewRoleColor(e.target.value)}
                      className="h-9 w-12 rounded cursor-pointer bg-transparent"
                      title="Renk"
                    />
                    <select
                      value={newBadge}
                      onChange={(e) => setNewBadge(e.target.value as RoleBadgeKey)}
                      className="h-9 rounded-lg bg-surface-container-highest px-2 font-label-sm"
                    >
                      {BADGE_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newBg}
                      onChange={(e) => setNewBg(e.target.value as RoleProfileBgKey)}
                      className="h-9 rounded-lg bg-surface-container-highest px-2 font-label-sm"
                    >
                      {BG_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy || !newRoleName.trim()}
                      onClick={() => void createRole()}
                      className="h-9 px-space-md rounded-lg bg-primary text-on-primary font-label-sm disabled:opacity-50"
                    >
                      Oluştur
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-label-sm text-outline">Önizleme:</span>
                    <RoleBadge badgeKey={newBadge} color={newRoleColor} label={newRoleName || 'Rol'} />
                  </div>
                </div>

                <ul className="flex flex-col gap-space-sm">
                  {roles.map((role) => (
                    <li
                      key={role.id}
                      className="rounded-xl border border-surface-container-highest bg-surface-container-low p-space-md flex flex-wrap items-center gap-space-sm"
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="font-body-sm text-on-surface font-semibold min-w-[6rem]">
                        {role.name}
                      </span>
                      <RoleBadge
                        badgeKey={role.badgeKey}
                        color={role.color}
                        label={role.name !== '@everyone' ? role.name : undefined}
                      />
                      {role.name !== '@everyone' && (
                        <>
                          <select
                            value={role.badgeKey || 'none'}
                            disabled={busy}
                            onChange={(e) => void patchRole(role, { badgeKey: e.target.value })}
                            className="h-8 rounded-lg bg-surface-container-highest px-2 font-label-sm"
                          >
                            {BADGE_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={role.profileBgKey || 'none'}
                            disabled={busy}
                            onChange={(e) =>
                              void patchRole(role, { profileBgKey: e.target.value })
                            }
                            className="h-8 rounded-lg bg-surface-container-highest px-2 font-label-sm"
                          >
                            {BG_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>
                                Arka plan: {o.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="color"
                            value={role.color}
                            disabled={busy}
                            onChange={(e) => void patchRole(role, { color: e.target.value })}
                            className="h-8 w-10 rounded cursor-pointer"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeRole(role)}
                            className="h-8 px-space-sm rounded-lg text-error hover:bg-error/10 font-label-sm ml-auto"
                          >
                            Sil
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
