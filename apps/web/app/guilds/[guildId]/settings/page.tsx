'use client';

import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { useGuildNav } from '@/hooks/useGuildNav';
import { useUserPreferences } from '@/lib/user-preferences';
import type { GuildSummary, RoleBadgeKey, RoleDto, RoleProfileBgKey } from '@dracord/types';
import { RoleBadge, SearchableSelect } from '@dracord/ui';

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

const ROLE_PERMISSIONS: { id: string; label: string }[] = [
  { id: 'VIEW_CHANNELS', label: 'Kanalları gör' },
  { id: 'SEND_MESSAGES', label: 'Mesaj gönder' },
  { id: 'ADD_REACTIONS', label: 'Tepki ekle' },
  { id: 'CREATE_POLLS', label: 'Anket oluştur' },
  { id: 'MANAGE_MESSAGES', label: 'Mesajları yönet' },
  { id: 'MANAGE_CHANNELS', label: 'Kanalları yönet' },
  { id: 'MANAGE_ROLES', label: 'Rolleri yönet' },
  { id: 'MANAGE_GUILD', label: 'Sunucuyu yönet' },
  { id: 'KICK_MEMBERS', label: 'Üye at' },
  { id: 'BAN_MEMBERS', label: 'Üye yasakla' },
  { id: 'MOVE_MEMBERS', label: 'Ses taşı / ayır' },
  { id: 'MODERATE_MEMBERS', label: 'Timeout' },
  { id: 'ADMINISTRATOR', label: 'Yönetici' },
];

type AuditRow = {
  id: string;
  actorId: string;
  action: string;
  targetId: string | null;
  createdAt: string;
};

type BanRow = {
  userId: string;
  reason: string | null;
  bannedById: string;
  createdAt: string;
};

export default function GuildSettingsPage({ params }: PageProps) {
  const { guildId } = use(params);
  const router = useRouter();
  const { client, user } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const { guilds, guild, channels, patchGuild, reload } = useGuildNav(guildId);
  const skin = prefs.appearance.guildSkins?.[guildId] ?? {};
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
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [slashCommands, setSlashCommands] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      usage: string;
      botName: string | null;
    }>
  >([]);
  const [slashName, setSlashName] = useState('');
  const [slashDesc, setSlashDesc] = useState('');
  const [slashUsage, setSlashUsage] = useState('');
  const [slashTemplate, setSlashTemplate] = useState('');

  const loadRoles = useCallback(async () => {
    try {
      const list = await client.listGuildRoles(guildId);
      setRoles(list.sort((a, b) => b.position - a.position));
    } catch {
      setRoles([]);
    }
  }, [client, guildId]);

  const loadModeration = useCallback(async () => {
    try {
      const [logs, banList] = await Promise.all([
        client.listGuildAuditLogs(guildId).catch(() => []),
        client.listGuildBans(guildId).catch(() => []),
      ]);
      setAuditLogs(logs.slice(0, 50));
      setBans(banList);
    } catch {
      setAuditLogs([]);
      setBans([]);
    }
  }, [client, guildId]);

  const loadSlashCommands = useCallback(async () => {
    try {
      const list = await client.listGuildSlashCommands(guildId);
      setSlashCommands(
        list.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          usage: c.usage,
          botName: c.botName,
        })),
      );
    } catch {
      setSlashCommands([]);
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
    void loadModeration();
    void loadSlashCommands();
  }, [loadRoles, loadModeration, loadSlashCommands]);

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

  const createSlashCommand = async () => {
    if (!slashName.trim() || !slashDesc.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await client.registerGuildSlashCommand(guildId, {
        name: slashName.trim(),
        description: slashDesc.trim(),
        usage: slashUsage.trim() || undefined,
        responseTemplate: slashTemplate.trim() || undefined,
      });
      setSlashName('');
      setSlashDesc('');
      setSlashUsage('');
      setSlashTemplate('');
      await loadSlashCommands();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Komut kaydedilemedi');
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

              <label className="flex items-center gap-space-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={Boolean(detail?.discoverable)}
                  disabled={busy || !canManage}
                  onChange={(e) => {
                    const discoverable = e.target.checked;
                    void (async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const updated = await client.updateGuild(guildId, { discoverable });
                        patchGuild(updated);
                        setDetail(updated);
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : 'Keşfet ayarı kaydedilemedi',
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                />
                <span className="font-body-sm text-on-surface">
                  Keşfette göster (herkes katılabilir)
                </span>
              </label>

              <div className="rounded-xl bg-surface-container-low p-space-md space-y-space-sm border border-surface-container-high">
                <h3 className="font-headline-md text-headline-md text-on-surface">
                  Kişisel görünüm
                </h3>
                <p className="font-body-sm text-on-surface-variant">
                  Yalnızca senin tarayıcında geçerli; diğer üyeleri etkilemez.
                </p>
                <label className="flex flex-col gap-space-xs">
                  <span className="font-label-sm text-on-surface-variant">Vurgu rengi</span>
                  <input
                    type="color"
                    value={skin.accent || '#bd93f9'}
                    onChange={(e) => {
                      const skins = { ...(prefs.appearance.guildSkins ?? {}) };
                      skins[guildId] = { ...skins[guildId], accent: e.target.value };
                      setSection('appearance', { guildSkins: skins });
                    }}
                    className="h-10 w-20 rounded cursor-pointer bg-transparent"
                  />
                </label>
                <label className="flex flex-col gap-space-xs">
                  <span className="font-label-sm text-on-surface-variant">Sidebar tonu</span>
                  <input
                    type="color"
                    value={skin.sidebarTint || '#282a36'}
                    onChange={(e) => {
                      const skins = { ...(prefs.appearance.guildSkins ?? {}) };
                      skins[guildId] = { ...skins[guildId], sidebarTint: e.target.value };
                      setSection('appearance', { guildSkins: skins });
                    }}
                    className="h-10 w-20 rounded cursor-pointer bg-transparent"
                  />
                </label>
                <label className="flex flex-col gap-space-xs">
                  <span className="font-label-sm text-on-surface-variant">Yoğunluk</span>
                  <select
                    value={skin.density || 'comfy'}
                    onChange={(e) => {
                      const skins = { ...(prefs.appearance.guildSkins ?? {}) };
                      skins[guildId] = {
                        ...skins[guildId],
                        density: e.target.value as 'compact' | 'comfy',
                      };
                      setSection('appearance', { guildSkins: skins });
                    }}
                    className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
                  >
                    <option value="comfy">Rahat</option>
                    <option value="compact">Kompakt</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="font-label-sm text-primary-container hover:underline"
                  onClick={() => {
                    const skins = { ...(prefs.appearance.guildSkins ?? {}) };
                    delete skins[guildId];
                    setSection('appearance', { guildSkins: skins });
                  }}
                >
                  Kişisel görünümü sıfırla
                </button>
              </div>

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

              <div className="rounded-xl border border-surface-container-highest bg-surface-container-low p-space-md space-y-space-sm">
                <h3 className="font-headline-md text-on-surface">AFK kanalı</h3>
                <p className="font-body-sm text-on-surface-variant">
                  Uzun süre konuşmayan kullanıcılar otomatik AFK kanalına taşınır ve susturulur.
                  AFK’dan başka bir ses kanalına geçince mikrofon/kulaklık açılır.
                </p>
                <label className="flex flex-col gap-space-xs">
                  <span className="font-label-sm text-on-surface-variant">AFK ses kanalı</span>
                  <SearchableSelect
                    fullWidth
                    value={detail?.afkChannelId ?? ''}
                    disabled={busy || !canManage}
                    placeholder="Kapalı"
                    onChange={(v) => {
                      const afkChannelId = v || null;
                      void (async () => {
                        setBusy(true);
                        try {
                          const updated = await client.updateGuild(guildId, { afkChannelId });
                          patchGuild(updated);
                          setDetail(updated);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'AFK kanalı kaydedilemedi');
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                    options={[
                      { value: '', label: 'Kapalı' },
                      ...channels
                        .filter((c) => c.type === 'VOICE')
                        .map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                </label>
                <label className="flex flex-col gap-space-xs">
                  <span className="font-label-sm text-on-surface-variant">Zaman aşımı (dakika)</span>
                  <SearchableSelect
                    fullWidth
                    value={String(detail?.afkTimeoutMinutes ?? 0)}
                    disabled={busy || !canManage || !detail?.afkChannelId}
                    onChange={(v) => {
                      const afkTimeoutMinutes = Number(v);
                      void (async () => {
                        setBusy(true);
                        try {
                          const updated = await client.updateGuild(guildId, { afkTimeoutMinutes });
                          patchGuild(updated);
                          setDetail(updated);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'AFK süresi kaydedilemedi');
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                    options={[0, 1, 5, 10, 15, 30, 60].map((m) => ({
                      value: String(m),
                      label: m === 0 ? 'Kapalı' : `${m} dk`,
                    }))}
                  />
                </label>
              </div>

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
                    <SearchableSelect
                      value={newBadge}
                      onChange={(v) => setNewBadge(v as RoleBadgeKey)}
                      className="!min-w-[8rem]"
                      options={BADGE_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
                    />
                    <SearchableSelect
                      value={newBg}
                      onChange={(v) => setNewBg(v as RoleProfileBgKey)}
                      className="!min-w-[8rem]"
                      options={BG_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
                    />
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
                          <SearchableSelect
                            value={role.badgeKey || 'none'}
                            disabled={busy}
                            onChange={(v) => void patchRole(role, { badgeKey: v })}
                            className="!min-w-[7.5rem]"
                            options={BADGE_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
                          />
                          <SearchableSelect
                            value={role.profileBgKey || 'none'}
                            disabled={busy}
                            onChange={(v) => void patchRole(role, { profileBgKey: v })}
                            className="!min-w-[8rem]"
                            options={BG_OPTIONS.map((o) => ({
                              value: o.id,
                              label: `Arka plan: ${o.label}`,
                            }))}
                          />
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
                            onClick={() =>
                              setExpandedRoleId((id) => (id === role.id ? null : role.id))
                            }
                            className="h-8 px-space-sm rounded-lg bg-surface-container-highest font-label-sm"
                          >
                            İzinler
                          </button>
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
                      {role.name !== '@everyone' && expandedRoleId === role.id && (
                        <div className="w-full mt-space-sm grid grid-cols-1 sm:grid-cols-2 gap-1 border-t border-surface-container-highest pt-space-sm">
                          {ROLE_PERMISSIONS.map((perm) => {
                            const checked = (role.permissions ?? []).includes(perm.id);
                            return (
                              <label
                                key={perm.id}
                                className="flex items-center gap-2 font-label-sm text-on-surface-variant cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={busy}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...new Set([...(role.permissions ?? []), perm.id])]
                                      : (role.permissions ?? []).filter((p) => p !== perm.id);
                                    void patchRole(role, { permissions: next });
                                  }}
                                />
                                {perm.label}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {canManage && (
            <section className="max-w-2xl mt-space-2xl space-y-space-lg">
              <div>
                <h2 className="font-headline-lg text-on-surface mb-space-sm">
                  Slash komutları
                </h2>
                <p className="font-body-sm text-outline mb-space-sm">
                  Sunucuya özel komutlar. Chat’te / yazınca listelenir; çağrılınca bot yanıt
                  verir. Şablonda {'{user}'}, {'{args}'}, {'{command}'} kullanılabilir.
                </p>
                <div className="flex flex-col gap-space-sm mb-space-md">
                  <input
                    value={slashName}
                    onChange={(e) => setSlashName(e.target.value)}
                    placeholder="komut-adı"
                    className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
                  />
                  <input
                    value={slashDesc}
                    onChange={(e) => setSlashDesc(e.target.value)}
                    placeholder="Açıklama"
                    className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
                  />
                  <input
                    value={slashUsage}
                    onChange={(e) => setSlashUsage(e.target.value)}
                    placeholder="Kullanım (örn. /selam [üye])"
                    className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
                  />
                  <input
                    value={slashTemplate}
                    onChange={(e) => setSlashTemplate(e.target.value)}
                    placeholder="Yanıt şablonu (isteğe bağlı) — Merhaba {user}!"
                    className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy || !slashName.trim() || !slashDesc.trim()}
                    onClick={() => void createSlashCommand()}
                    className="self-start px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
                  >
                    Komut ekle
                  </button>
                </div>
                {slashCommands.length === 0 ? (
                  <p className="font-body-sm text-outline">Henüz özel komut yok.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {slashCommands.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start gap-2 rounded-lg bg-surface-container-low px-space-sm py-space-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-label-sm text-primary-container truncate">
                            /{c.name}
                            {c.botName ? (
                              <span className="text-outline font-normal"> · {c.botName}</span>
                            ) : null}
                          </p>
                          <p className="font-body-sm text-on-surface truncate">{c.description}</p>
                          <p className="font-label-sm text-outline truncate">{c.usage}</p>
                        </div>
                        <button
                          type="button"
                          className="font-label-sm text-error hover:underline shrink-0"
                          onClick={() => {
                            void client
                              .deleteGuildSlashCommand(guildId, c.id)
                              .then(() => loadSlashCommands())
                              .catch((err: unknown) =>
                                setError(
                                  err instanceof Error ? err.message : 'Silinemedi',
                                ),
                              );
                          }}
                        >
                          Sil
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h2 className="font-headline-lg text-on-surface mb-space-sm">Yasaklılar</h2>
                {bans.length === 0 ? (
                  <p className="font-body-sm text-outline">Yasaklı üye yok.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {bans.map((b) => (
                      <li
                        key={b.userId}
                        className="flex items-center gap-2 rounded-lg bg-surface-container-low px-space-sm py-space-sm"
                      >
                        <span className="font-mono text-body-sm flex-1 truncate">{b.userId}</span>
                        <button
                          type="button"
                          className="font-label-sm text-primary-container hover:underline"
                          onClick={() => {
                            void client.unbanGuildMember(guildId, b.userId).then(() => {
                              void loadModeration();
                            });
                          }}
                        >
                          Yasağı kaldır
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h2 className="font-headline-lg text-on-surface mb-space-sm">Denetim kaydı</h2>
                {auditLogs.length === 0 ? (
                  <p className="font-body-sm text-outline">Henüz kayıt yok.</p>
                ) : (
                  <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                    {auditLogs.map((l) => (
                      <li
                        key={l.id}
                        className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-label-sm text-on-surface-variant"
                      >
                        <span className="text-on-surface">{l.action}</span>
                        {l.targetId ? ` → ${l.targetId.slice(0, 8)}…` : ''}
                        <span className="text-outline ml-2">
                          {new Date(l.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
