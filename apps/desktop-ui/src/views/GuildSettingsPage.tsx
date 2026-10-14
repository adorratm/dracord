import { useCallback, useEffect, useState } from 'react';
import type {
  ChannelSummary,
  GuildInviteDto,
  GuildSummary,
  PublicUser,
  RoleBadgeKey,
  RoleDto,
  RoleProfileBgKey,
} from '@dracord/types';
import { cn, RoleBadge, SearchableSelect } from '@dracord/ui';
import { useAuth } from '../auth';

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

type Tab =
  | 'general'
  | 'channels'
  | 'roles'
  | 'members'
  | 'moderation'
  | 'invite';

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'general', label: 'Genel', icon: 'tune' },
  { id: 'channels', label: 'Kanallar', icon: 'tag' },
  { id: 'roles', label: 'Roller & rozetler', icon: 'badge' },
  { id: 'members', label: 'Üyeler', icon: 'group' },
  { id: 'moderation', label: 'Moderasyon', icon: 'gavel' },
  { id: 'invite', label: 'Davet', icon: 'link' },
];

const ROLE_PERMISSIONS: { id: string; label: string }[] = [
  { id: 'VIEW_CHANNELS', label: 'Kanalları gör' },
  { id: 'SEND_MESSAGES', label: 'Mesaj gönder' },
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

export function GuildSettingsPage({
  guildId,
  onBack,
  onChannelsChanged,
  onInviteCreated,
}: {
  guildId: string;
  onBack: () => void;
  onChannelsChanged: () => void;
  onInviteCreated?: (url: string) => void;
}) {
  const { client } = useAuth();
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [name, setName] = useState('');
  const [discoverable, setDiscoverable] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [afkChannelId, setAfkChannelId] = useState<string>('');
  const [afkTimeout, setAfkTimeout] = useState(5);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [invite, setInvite] = useState<GuildInviteDto | null>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [newChannel, setNewChannel] = useState('');
  const [newChannelType, setNewChannelType] = useState<'TEXT' | 'VOICE' | 'FORUM'>('TEXT');
  const [newRole, setNewRole] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#5865F2');
  const [newBadge, setNewBadge] = useState<RoleBadgeKey>('star');
  const [newBg, setNewBg] = useState<RoleProfileBgKey>('aurora');
  const [roleBusy, setRoleBusy] = useState(false);
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<
    Array<{ id: string; actorId: string; action: string; targetId: string | null; createdAt: string }>
  >([]);
  const [bans, setBans] = useState<
    Array<{ userId: string; reason: string | null; bannedById: string; createdAt: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reloadModeration = useCallback(() => {
    void Promise.all([
      client.listGuildAuditLogs(guildId).catch(() => []),
      client.listGuildBans(guildId).catch(() => []),
    ]).then(([logs, banList]) => {
      setAuditLogs(logs.slice(0, 50));
      setBans(banList);
    });
  }, [client, guildId]);

  useEffect(() => {
    void client.getGuild(guildId).then((g) => {
      setGuild(g);
      setName(g.name);
      setDiscoverable(Boolean(g.discoverable));
      setBannerUrl(g.bannerUrl ?? '');
      setIconUrl(g.iconUrl ?? '');
      setAfkChannelId(g.afkChannelId ?? '');
      setAfkTimeout(g.afkTimeoutMinutes ?? 5);
    });
    void client.listGuildRoles(guildId).then(setRoles);
    void client.getGuildChannels(guildId).then(setChannels);
    void client.getGuildMembers(guildId).then(setMembers);
    reloadModeration();
  }, [client, guildId, reloadModeration]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const voiceChannels = channels.filter((c) => c.type === 'VOICE');

  return (
    <div className="flex h-full min-h-0 bg-surface">
      <aside className="w-56 shrink-0 border-r border-surface-container-highest bg-surface-container-low flex flex-col">
        <button
          type="button"
          onClick={onBack}
          className="h-12 px-3 flex items-center gap-2 text-on-surface-variant hover:text-on-surface border-b border-surface-container-highest"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          <span className="font-label-sm truncate">{guild?.name ?? 'Sunucu'}</span>
        </button>
        <nav className="p-2 flex-1 overflow-auto">
          <p className="px-2 py-2 font-label-sm text-outline uppercase tracking-wider">
            Sunucu ayarları
          </p>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMsg(null);
                setError(null);
                setTab(item.id);
              }}
              className={cn(
                'w-full h-10 px-3 rounded-lg flex items-center gap-2 text-sm font-semibold mb-0.5',
                tab === item.id
                  ? 'bg-surface-container-high text-on-surface'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
              )}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="max-w-2xl">
          {error && <p className="text-error mb-3">{error}</p>}
          {msg && <p className="text-primary-container mb-3">{msg}</p>}

          {tab === 'general' && (
            <>
              <h2 className="font-headline-lg text-headline-lg mt-0 mb-1">Genel</h2>
              <p className="text-on-surface-variant mb-4">
                Sunucu adı, ikon, afiş ve AFK ayarları.
              </p>
              <label className="block mb-3">
                <span className="text-xs text-on-surface-variant">Sunucu adı</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                />
              </label>
              <label className="block mb-3">
                <span className="text-xs text-on-surface-variant">İkon URL</span>
                <input
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                />
              </label>
              <label className="block mb-3">
                <span className="text-xs text-on-surface-variant">Afiş URL</span>
                <input
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                />
              </label>
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={discoverable}
                  onChange={(e) => setDiscoverable(e.target.checked)}
                />
                <span className="text-sm">Keşfette göster</span>
              </label>
              <label className="block mb-3">
                <span className="text-xs text-on-surface-variant">AFK kanalı</span>
                <select
                  value={afkChannelId}
                  onChange={(e) => setAfkChannelId(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                >
                  <option value="">Yok</option>
                  {voiceChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block mb-4">
                <span className="text-xs text-on-surface-variant">AFK süre (dk)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={afkTimeout}
                  onChange={(e) => setAfkTimeout(Number(e.target.value) || 5)}
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                />
              </label>
              <button
                type="button"
                className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold"
                onClick={() => {
                  setError(null);
                  void client
                    .updateGuild(guildId, {
                      name: name.trim(),
                      discoverable,
                      iconUrl: iconUrl.trim() || null,
                      bannerUrl: bannerUrl.trim() || null,
                      afkChannelId: afkChannelId || null,
                      afkTimeoutMinutes: afkTimeout,
                    })
                    .then((g) => {
                      setGuild(g);
                      setMsg('Kaydedildi');
                    })
                    .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
                }}
              >
                Kaydet
              </button>
            </>
          )}

          {tab === 'channels' && (
            <>
              <h2 className="font-headline-lg text-headline-lg mt-0 mb-4">Kanallar</h2>
              <div className="flex gap-2 mb-4 flex-wrap">
                <input
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  placeholder="Yeni kanal"
                  className="flex-1 min-w-[140px] h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                />
                <select
                  value={newChannelType}
                  onChange={(e) =>
                    setNewChannelType(e.target.value as 'TEXT' | 'VOICE' | 'FORUM')
                  }
                  className="h-10 px-2 rounded-lg bg-surface-container-highest"
                >
                  <option value="TEXT">Metin</option>
                  <option value="VOICE">Ses</option>
                  <option value="FORUM">Forum</option>
                </select>
                <button
                  type="button"
                  className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold"
                  onClick={() => {
                    if (!newChannel.trim()) return;
                    void client
                      .createChannel(guildId, {
                        name: newChannel.trim(),
                        type: newChannelType,
                      })
                      .then(() => {
                        setNewChannel('');
                        void client.getGuildChannels(guildId).then(setChannels);
                        onChannelsChanged();
                      })
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : 'Oluşturulamadı'),
                      );
                  }}
                >
                  Ekle
                </button>
              </div>
              <div className="rounded-xl bg-surface-container-low divide-y divide-surface-container-high overflow-hidden">
                {channels
                  .filter((c) => c.type !== 'CATEGORY')
                  .map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-4 py-3 gap-2"
                    >
                      <span className="truncate">
                        <span className="text-on-surface-variant mr-1">
                          {c.type === 'VOICE'
                            ? '🔊'
                            : c.type === 'GAME' || c.type === 'WATCH_PARTY'
                              ? '🎮'
                              : '#'}
                        </span>
                        {c.name}
                      </span>
                      <button
                        type="button"
                        className="text-sm text-error hover:underline shrink-0"
                        onClick={() => {
                          if (!confirm(`#${c.name} silinsin mi?`)) return;
                          void client.deleteChannel(c.id).then(() => {
                            void client.getGuildChannels(guildId).then(setChannels);
                            onChannelsChanged();
                          });
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  ))}
              </div>
            </>
          )}

          {tab === 'roles' && (
            <>
              <h2 className="font-headline-lg text-headline-lg mt-0 mb-2">Roller & rozetler</h2>
              <p className="text-sm text-on-surface-variant mb-4">
                Animasyonlu rozet ve profil arka planı rol bazlıdır. Üye listesinde sağ tık → rol
                ver.
              </p>
              <div className="rounded-xl border border-surface-container-highest bg-surface-container-low p-4 mb-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-outline font-semibold">
                  Yeni rol
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="Rol adı"
                    className="h-9 px-3 rounded-lg bg-surface-container-highest outline-none flex-1 min-w-[8rem]"
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
                    disabled={roleBusy || !newRole.trim()}
                    className="h-9 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
                    onClick={() => {
                      if (!newRole.trim()) return;
                      setRoleBusy(true);
                      void client
                        .createGuildRole(guildId, {
                          name: newRole.trim(),
                          color: newRoleColor,
                          badgeKey: newBadge,
                          profileBgKey: newBg,
                          hoist: true,
                          permissions: ['VIEW_CHANNELS', 'SEND_MESSAGES', 'ADD_REACTIONS'],
                        })
                        .then(() => {
                          setNewRole('');
                          return client.listGuildRoles(guildId).then(setRoles);
                        })
                        .catch((e) =>
                          setError(e instanceof Error ? e.message : 'Rol oluşturulamadı'),
                        )
                        .finally(() => setRoleBusy(false));
                    }}
                  >
                    Oluştur
                  </button>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-outline">Önizleme:</span>
                  <RoleBadge
                    badgeKey={newBadge}
                    color={newRoleColor}
                    label={newRole || 'Rol'}
                  />
                </div>
              </div>
              <ul className="flex flex-col gap-2">
                {roles.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-surface-container-highest bg-surface-container-low p-4 flex flex-wrap items-center gap-2"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: r.color || '#888' }}
                    />
                    <span className="font-semibold min-w-[6rem]">{r.name}</span>
                    <RoleBadge
                      badgeKey={r.badgeKey}
                      color={r.color}
                      label={r.name !== '@everyone' ? r.name : undefined}
                    />
                    {r.name !== '@everyone' && (
                      <>
                        <SearchableSelect
                          value={r.badgeKey || 'none'}
                          disabled={roleBusy}
                          onChange={(v) => {
                            setRoleBusy(true);
                            void client
                              .updateGuildRole(guildId, r.id, { badgeKey: v })
                              .then(() => client.listGuildRoles(guildId).then(setRoles))
                              .finally(() => setRoleBusy(false));
                          }}
                          className="!min-w-[7.5rem]"
                          options={BADGE_OPTIONS.map((o) => ({
                            value: o.id,
                            label: o.label,
                          }))}
                        />
                        <SearchableSelect
                          value={r.profileBgKey || 'none'}
                          disabled={roleBusy}
                          onChange={(v) => {
                            setRoleBusy(true);
                            void client
                              .updateGuildRole(guildId, r.id, { profileBgKey: v })
                              .then(() => client.listGuildRoles(guildId).then(setRoles))
                              .finally(() => setRoleBusy(false));
                          }}
                          className="!min-w-[8rem]"
                          options={BG_OPTIONS.map((o) => ({
                            value: o.id,
                            label: `Arka plan: ${o.label}`,
                          }))}
                        />
                        <input
                          type="color"
                          value={r.color || '#5865F2'}
                          disabled={roleBusy}
                          onChange={(e) => {
                            setRoleBusy(true);
                            void client
                              .updateGuildRole(guildId, r.id, { color: e.target.value })
                              .then(() => client.listGuildRoles(guildId).then(setRoles))
                              .finally(() => setRoleBusy(false));
                          }}
                          className="h-8 w-10 rounded cursor-pointer"
                        />
                        <button
                          type="button"
                          disabled={roleBusy}
                          onClick={() =>
                            setExpandedRoleId((id) => (id === r.id ? null : r.id))
                          }
                          className="h-8 px-2 rounded-lg bg-surface-container-highest text-sm font-semibold"
                        >
                          İzinler
                        </button>
                        <button
                          type="button"
                          className="h-8 text-sm text-error"
                          onClick={() => {
                            if (!confirm('Rol silinsin mi?')) return;
                            void client
                              .deleteGuildRole(guildId, r.id)
                              .then(() => client.listGuildRoles(guildId).then(setRoles));
                          }}
                        >
                          Sil
                        </button>
                      </>
                    )}
                    {expandedRoleId === r.id && r.name !== '@everyone' && (
                      <div className="w-full mt-2 grid gap-1 border-t border-surface-container-high pt-3">
                        {ROLE_PERMISSIONS.map((p) => {
                          const has = (r.permissions ?? []).includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 text-sm text-on-surface cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={has}
                                onChange={() => {
                                  const next = has
                                    ? (r.permissions ?? []).filter((x) => x !== p.id)
                                    : [...(r.permissions ?? []), p.id];
                                  void client
                                    .updateGuildRole(guildId, r.id, { permissions: next })
                                    .then(() => client.listGuildRoles(guildId).then(setRoles));
                                }}
                              />
                              {p.label}
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

          {tab === 'members' && (
            <>
              <h2 className="font-headline-lg text-headline-lg mt-0 mb-4">Üyeler</h2>
              <div className="rounded-xl bg-surface-container-low divide-y divide-surface-container-high overflow-hidden">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between px-4 py-3 gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{m.displayName}</div>
                      <div className="text-xs text-on-surface-variant truncate">
                        @{m.username} · {m.status ?? 'OFFLINE'}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        className="h-8 px-2 rounded-lg text-sm bg-error-container text-on-error-container"
                        onClick={() => {
                          if (!confirm('Üye atılsın mı?')) return;
                          void client
                            .kickGuildMember(guildId, m.id)
                            .then(() => client.getGuildMembers(guildId).then(setMembers));
                        }}
                      >
                        At
                      </button>
                      <button
                        type="button"
                        className="h-8 px-2 rounded-lg text-sm bg-error text-on-error"
                        onClick={() => {
                          if (!confirm('Üye yasaklansın mı?')) return;
                          void client
                            .banGuildMember(guildId, m.id)
                            .then(() => client.getGuildMembers(guildId).then(setMembers));
                        }}
                      >
                        Yasakla
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'moderation' && (
            <>
              <h2 className="font-headline-lg text-headline-lg mt-0 mb-2">Moderasyon</h2>
              <p className="text-on-surface-variant mb-4">Denetim kayıtları ve yasaklar.</p>
              <h3 className="font-semibold mb-2">Yasaklar</h3>
              <div className="rounded-xl bg-surface-container-low divide-y divide-surface-container-high overflow-hidden mb-6">
                {bans.length === 0 && (
                  <p className="px-4 py-3 text-sm text-on-surface-variant">Yasak yok</p>
                )}
                {bans.map((b) => (
                  <div key={b.userId} className="flex items-center justify-between px-4 py-3">
                    <div className="text-sm">
                      <div className="font-medium">{b.userId}</div>
                      <div className="text-xs text-on-surface-variant">
                        {b.reason || 'Sebep yok'} ·{' '}
                        {new Date(b.createdAt).toLocaleString('tr-TR')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-primary-container"
                      onClick={() => {
                        void client.unbanGuildMember(guildId, b.userId).then(reloadModeration);
                      }}
                    >
                      Yasağı kaldır
                    </button>
                  </div>
                ))}
              </div>
              <h3 className="font-semibold mb-2">Denetim kaydı</h3>
              <div className="rounded-xl bg-surface-container-low divide-y divide-surface-container-high overflow-hidden">
                {auditLogs.length === 0 && (
                  <p className="px-4 py-3 text-sm text-on-surface-variant">Kayıt yok</p>
                )}
                {auditLogs.map((a) => (
                  <div key={a.id} className="px-4 py-3 text-sm">
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-on-surface-variant">
                      {a.actorId}
                      {a.targetId ? ` → ${a.targetId}` : ''} ·{' '}
                      {new Date(a.createdAt).toLocaleString('tr-TR')}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'invite' && (
            <>
              <h2 className="font-headline-lg text-headline-lg mt-0 mb-2">Davet linki</h2>
              <p className="text-on-surface-variant mb-4">
                Paylaşılabilir davet oluştur; link panoya kopyalanır.
              </p>
              <button
                type="button"
                className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold"
                onClick={() => {
                  void client
                    .createInvite(guildId)
                    .then((inv) => {
                      setInvite(inv);
                      const url = inv.url || `https://dracord.com.tr/invite/${inv.code}`;
                      onInviteCreated?.(url);
                      void navigator.clipboard?.writeText(url);
                      setMsg('Davet kopyalandı');
                    })
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : 'Davet oluşturulamadı'),
                    );
                }}
              >
                Davet oluştur
              </button>
              {invite && (
                <code className="mt-4 block p-3 rounded-lg bg-surface-container-highest text-sm break-all">
                  {invite.url || invite.code}
                </code>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
