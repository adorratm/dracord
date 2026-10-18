import { useCallback, useEffect, useState } from 'react';
import type {
  CategoryDto,
  ChannelSummary,
  DiscoverCategory,
  GameChannelKind,
  GuildInviteDto,
  GuildSummary,
  PublicUser,
  RoleBadgeKey,
  RoleDto,
  RoleProfileBgKey,
} from '@dracord/types';
import { DISCOVER_CATEGORIES } from '@dracord/types';
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
  | 'slash'
  | 'invite';

const NAV: { id: Tab; label: string; icon: string; need?: 'manage' | 'roles' | 'channels' | 'mod' }[] =
  [
    { id: 'general', label: 'Genel', icon: 'tune', need: 'manage' },
    { id: 'channels', label: 'Kanallar', icon: 'tag', need: 'channels' },
    { id: 'roles', label: 'Roller & rozetler', icon: 'badge', need: 'roles' },
    { id: 'members', label: 'Üyeler', icon: 'group', need: 'mod' },
    { id: 'moderation', label: 'Moderasyon', icon: 'gavel', need: 'manage' },
    { id: 'slash', label: 'Slash komutları', icon: 'terminal', need: 'manage' },
    { id: 'invite', label: 'Davet', icon: 'link' },
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

const AFK_TIMEOUTS = [0, 1, 5, 10, 15, 30, 60];

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
  const [discoverCategory, setDiscoverCategory] = useState<DiscoverCategory>('gaming');
  const [bannerUrl, setBannerUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [afkChannelId, setAfkChannelId] = useState<string>('');
  const [afkTimeout, setAfkTimeout] = useState(5);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [invite, setInvite] = useState<GuildInviteDto | null>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [canManage, setCanManage] = useState(false);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [canManageChannels, setCanManageChannels] = useState(false);
  const [canModMembers, setCanModMembers] = useState(false);
  const [newChannel, setNewChannel] = useState('');
  const [newChannelType, setNewChannelType] = useState<
    'TEXT' | 'VOICE' | 'FORUM' | 'GAME' | 'WATCH_PARTY'
  >('TEXT');
  const [newGameKind, setNewGameKind] = useState<GameChannelKind>('billiards');
  const [newCategory, setNewCategory] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#5865F2');
  const [newBadge, setNewBadge] = useState<RoleBadgeKey>('star');
  const [newBg, setNewBg] = useState<RoleProfileBgKey>('aurora');
  const [roleBusy, setRoleBusy] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const loadSlashCommands = useCallback(() => {
    void client
      .listGuildSlashCommands(guildId)
      .then((list) =>
        setSlashCommands(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            usage: c.usage,
            botName: c.botName,
          })),
        ),
      )
      .catch(() => setSlashCommands([]));
  }, [client, guildId]);

  useEffect(() => {
    void client.getGuild(guildId).then((g) => {
      setGuild(g);
      setName(g.name);
      setDiscoverable(Boolean(g.discoverable));
      setDiscoverCategory((g.discoverCategory as DiscoverCategory) || 'gaming');
      setBannerUrl(g.bannerUrl ?? '');
      setIconUrl(g.iconUrl ?? '');
      setAfkChannelId(g.afkChannelId ?? '');
      setAfkTimeout(g.afkTimeoutMinutes ?? 5);
    });
    void client
      .getGuildPermissions(guildId)
      .then((p) => {
        const set = new Set(p.permissions ?? []);
        const god = p.owner || set.has('ADMINISTRATOR');
        setCanManage(god || set.has('MANAGE_GUILD'));
        setCanManageRoles(god || set.has('MANAGE_ROLES'));
        setCanManageChannels(god || set.has('MANAGE_CHANNELS'));
        setCanModMembers(
          god ||
            set.has('KICK_MEMBERS') ||
            set.has('BAN_MEMBERS') ||
            set.has('MODERATE_MEMBERS'),
        );
      })
      .catch(() => {
        setCanManage(false);
        setCanManageRoles(false);
        setCanManageChannels(false);
        setCanModMembers(false);
      });
    void client.listGuildRoles(guildId).then(setRoles);
    void client.getGuildChannels(guildId).then(setChannels);
    void client
      .listGuildCategories(guildId)
      .then(setCategories)
      .catch(() => setCategories([]));
    void client.getGuildMembers(guildId).then(setMembers);
    reloadModeration();
    loadSlashCommands();
  }, [client, guildId, reloadModeration, loadSlashCommands]);

  const canSeeTab = useCallback(
    (item: (typeof NAV)[number]) => {
      if (!item.need) return true;
      if (item.need === 'manage') return canManage;
      if (item.need === 'roles') return canManageRoles;
      if (item.need === 'channels') return canManageChannels;
      if (item.need === 'mod') return canModMembers || canManage;
      return true;
    },
    [canManage, canManageRoles, canManageChannels, canModMembers],
  );

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
        setGuild(updated);
        if (kind === 'icon') setIconUrl(updated.iconUrl ?? '');
        else setBannerUrl(updated.bannerUrl ?? '');
        setMsg(kind === 'icon' ? 'İkon güncellendi' : 'Kapak güncellendi');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Görsel yüklenemedi');
      } finally {
        setBusy(false);
      }
    },
    [client, guildId],
  );

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
          {NAV.filter(canSeeTab).map((item) => (
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
                Sunucu adı, ikon, afiş, keşfet ve AFK ayarları.
              </p>
              {!canManage ? (
                <p className="text-on-surface-variant">Bu sunucuyu düzenlemek için yetkin yok.</p>
              ) : (
                <>
                  <div className="relative h-28 rounded-xl overflow-hidden bg-surface-container-highest border border-surface-container-high mb-4">
                    {bannerUrl ? (
                      <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-outline text-sm">
                        Kapak görseli yok
                      </div>
                    )}
                    <label className="absolute right-2 bottom-2 h-8 px-3 rounded-lg bg-black/60 text-white text-sm flex items-center cursor-pointer">
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
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-surface-container-highest border border-surface-container-high shrink-0">
                      {iconUrl ? (
                        <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold">
                          {(name || 'S').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <label className="h-9 px-3 rounded-lg bg-surface-container-highest text-sm flex items-center cursor-pointer">
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
                  <label className="block mb-3">
                    <span className="text-xs text-on-surface-variant">Sunucu adı</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={discoverable}
                      onChange={(e) => setDiscoverable(e.target.checked)}
                    />
                    <span className="text-sm">Keşfette göster (herkes katılabilir)</span>
                  </label>
                  {discoverable ? (
                    <label className="block mb-3">
                      <span className="text-xs text-on-surface-variant">Keşfet kategorisi</span>
                      <select
                        value={discoverCategory}
                        onChange={(e) =>
                          setDiscoverCategory(e.target.value as DiscoverCategory)
                        }
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                      >
                        {DISCOVER_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="rounded-xl border border-surface-container-high bg-surface-container-low p-4 mb-4 space-y-3">
                    <h3 className="font-semibold m-0">AFK kanalı</h3>
                    <p className="text-sm text-on-surface-variant m-0">
                      Uzun süre konuşmayan kullanıcılar AFK kanalına taşınır.
                    </p>
                    <label className="block">
                      <span className="text-xs text-on-surface-variant">AFK ses kanalı</span>
                      <select
                        value={afkChannelId}
                        onChange={(e) => setAfkChannelId(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                      >
                        <option value="">Kapalı</option>
                        {voiceChannels.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-on-surface-variant">Zaman aşımı</span>
                      <select
                        value={afkTimeout}
                        disabled={!afkChannelId}
                        onChange={(e) => setAfkTimeout(Number(e.target.value))}
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none disabled:opacity-50"
                      >
                        {AFK_TIMEOUTS.map((m) => (
                          <option key={m} value={m}>
                            {m === 0 ? 'Kapalı' : `${m} dk`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <dl className="grid gap-2 mb-4">
                    <div className="rounded-lg bg-surface-container-low p-3">
                      <dt className="text-xs text-outline uppercase">Sunucu ID</dt>
                      <dd className="text-sm break-all m-0 mt-1">{guildId}</dd>
                    </div>
                    <div className="rounded-lg bg-surface-container-low p-3">
                      <dt className="text-xs text-outline uppercase">Sahip ID</dt>
                      <dd className="text-sm break-all m-0 mt-1">{guild?.ownerId ?? '—'}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    disabled={busy || !name.trim()}
                    className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
                    onClick={() => {
                      setError(null);
                      setBusy(true);
                      void client
                        .updateGuild(guildId, {
                          name: name.trim(),
                          discoverable,
                          discoverCategory: discoverable ? discoverCategory : undefined,
                          afkChannelId: afkChannelId || null,
                          afkTimeoutMinutes: afkTimeout,
                        })
                        .then((g) => {
                          setGuild(g);
                          setMsg('Kaydedildi');
                        })
                        .catch((e) => setError(e instanceof Error ? e.message : 'Hata'))
                        .finally(() => setBusy(false));
                    }}
                  >
                    Kaydet
                  </button>
                </>
              )}
            </>
          )}

          {tab === 'channels' && (
            <>
              <h2 className="font-headline-lg text-headline-lg mt-0 mb-4">Kanallar</h2>
              <div className="flex gap-2 mb-3 flex-wrap">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Yeni kategori"
                  className="flex-1 min-w-[140px] h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                />
                <button
                  type="button"
                  className="h-10 px-4 rounded-lg bg-surface-container-high font-bold"
                  onClick={() => {
                    if (!newCategory.trim()) return;
                    void client
                      .createGuildCategory(guildId, newCategory.trim())
                      .then(() => {
                        setNewCategory('');
                        void client.listGuildCategories(guildId).then(setCategories);
                        onChannelsChanged();
                      })
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : 'Kategori oluşturulamadı'),
                      );
                  }}
                >
                  Kategori ekle
                </button>
              </div>
              {categories.length > 0 ? (
                <p className="text-sm text-on-surface-variant mb-3">
                  Kategoriler: {categories.map((c) => c.name).join(', ')}
                </p>
              ) : null}
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
                    setNewChannelType(
                      e.target.value as 'TEXT' | 'VOICE' | 'FORUM' | 'GAME' | 'WATCH_PARTY',
                    )
                  }
                  className="h-10 px-2 rounded-lg bg-surface-container-highest"
                >
                  <option value="TEXT">Metin</option>
                  <option value="VOICE">Ses</option>
                  <option value="FORUM">Forum</option>
                  <option value="GAME">Oyun</option>
                  <option value="WATCH_PARTY">Watch Party</option>
                </select>
                {newChannelType === 'GAME' ? (
                  <select
                    value={newGameKind}
                    onChange={(e) => setNewGameKind(e.target.value as GameChannelKind)}
                    className="h-10 px-2 rounded-lg bg-surface-container-highest"
                  >
                    <option value="billiards">Bilardo</option>
                    <option value="okey">Okey</option>
                    <option value="bowling">Bowling</option>
                    <option value="tavla">Tavla</option>
                    <option value="blackjack">Blackjack</option>
                    <option value="trivia">Trivia</option>
                    <option value="words">Kelime</option>
                  </select>
                ) : null}
                <button
                  type="button"
                  className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold"
                  onClick={() => {
                    if (!newChannel.trim()) return;
                    void client
                      .createChannel(guildId, {
                        name: newChannel.trim(),
                        type: newChannelType,
                        gameKind: newChannelType === 'GAME' ? newGameKind : null,
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
              {!canManageRoles ? (
                <p className="text-on-surface-variant">Rol yönetmek için yetkin yok.</p>
              ) : (
              <>
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

          {tab === 'slash' && (
            <>
              <h2 className="font-headline-lg text-headline-lg mt-0 mb-2">Slash komutları</h2>
              <p className="text-sm text-on-surface-variant mb-4">
                Sunucuya özel komutlar. Chat’te / yazınca listelenir. Şablonda {'{user}'},{' '}
                {'{args}'}, {'{command}'} kullanılabilir.
              </p>
              {!canManage ? (
                <p className="text-on-surface-variant">Komut yönetmek için yetkin yok.</p>
              ) : (
                <>
                  <div className="flex flex-col gap-2 mb-4">
                    <input
                      value={slashName}
                      onChange={(e) => setSlashName(e.target.value)}
                      placeholder="komut-adı"
                      className="h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                    />
                    <input
                      value={slashDesc}
                      onChange={(e) => setSlashDesc(e.target.value)}
                      placeholder="Açıklama"
                      className="h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                    />
                    <input
                      value={slashUsage}
                      onChange={(e) => setSlashUsage(e.target.value)}
                      placeholder="Kullanım (örn. /selam [üye])"
                      className="h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                    />
                    <input
                      value={slashTemplate}
                      onChange={(e) => setSlashTemplate(e.target.value)}
                      placeholder="Yanıt şablonu — Merhaba {user}!"
                      className="h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy || !slashName.trim() || !slashDesc.trim()}
                      className="self-start h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
                      onClick={() => {
                        setBusy(true);
                        setError(null);
                        void client
                          .registerGuildSlashCommand(guildId, {
                            name: slashName.trim(),
                            description: slashDesc.trim(),
                            usage: slashUsage.trim() || undefined,
                            responseTemplate: slashTemplate.trim() || undefined,
                          })
                          .then(() => {
                            setSlashName('');
                            setSlashDesc('');
                            setSlashUsage('');
                            setSlashTemplate('');
                            loadSlashCommands();
                            setMsg('Komut eklendi');
                          })
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : 'Komut kaydedilemedi'),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      Komut ekle
                    </button>
                  </div>
                  {slashCommands.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">Henüz özel komut yok.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {slashCommands.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-primary-container truncate">
                              /{c.name}
                              {c.botName ? (
                                <span className="text-outline font-normal"> · {c.botName}</span>
                              ) : null}
                            </p>
                            <p className="text-sm truncate">{c.description}</p>
                            <p className="text-xs text-outline truncate">{c.usage}</p>
                          </div>
                          <button
                            type="button"
                            className="text-sm text-error shrink-0"
                            onClick={() => {
                              void client
                                .deleteGuildSlashCommand(guildId, c.id)
                                .then(() => loadSlashCommands())
                                .catch((e) =>
                                  setError(e instanceof Error ? e.message : 'Silinemedi'),
                                );
                            }}
                          >
                            Sil
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
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
