import { useEffect, useMemo, useState } from 'react';
import type { ChannelSummary, GuildSummary, PublicUser } from '@dracord/types';
import {
  ChannelSidebar,
  ConfirmDialog,
  Modal,
  SearchableSelect,
  ServerRail,
  TitleBar,
  type ServerRailGuild,
  type ServerRailGuildAction,
  type TitleBarNavId,
} from '@dracord/ui';
import { useAuth } from '../auth';
import { buildSidebarCategories } from '../lib/channels';
import { readGuildLastChannel, readLastChannel, rememberChannel } from '../lib/lastChannel';
import { ChatPanel } from '../views/ChatPanel';
import { VoicePanel } from '../views/VoicePanel';
import { ActivityPanel } from '../views/ActivityPanel';
import { DmPanel } from '../views/DmPanel';
import { DiscoverPage } from '../views/DiscoverPage';
import { SettingsPage } from '../views/SettingsPage';
import { FriendsHubView } from '../views/FriendsHub';
// FriendsHubView = web FriendsHub UI paketi
import { SearchOverlay } from '../views/SearchOverlay';
import { NotificationsPanel } from '../views/NotificationsPanel';
import { GuildSettingsPage } from '../views/GuildSettingsPage';
import { MemberPanel } from '../views/MemberPanel';
import { NotificationBell } from '../views/NotificationBell';

type View =
  | { kind: 'home' }
  | { kind: 'dms' }
  | { kind: 'friends' }
  | { kind: 'discover' }
  | { kind: 'settings' }
  | { kind: 'notifications' }
  | { kind: 'guild-settings'; guildId: string }
  | { kind: 'channel'; guildId: string; channelId: string };

const COLLAPSED_KEY = 'dracord.desktop.collapsedCats';

export function Shell() {
  const { client, user, logout } = useAuth();
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [showMembers, setShowMembers] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<ServerRailGuild | null>(null);
  const [serverName, setServerName] = useState('');
  const [discoverable, setDiscoverable] = useState(true);
  const [discoverCategory, setDiscoverCategory] = useState('gaming');
  const [inviteCode, setInviteCode] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  const activeGuildId = view.kind === 'channel' || view.kind === 'guild-settings' ? view.guildId : null;
  const activeChannelId = view.kind === 'channel' ? view.channelId : null;
  const activeGuild = guilds.find((g) => g.id === activeGuildId) ?? null;
  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  const titleNav: TitleBarNavId =
    view.kind === 'dms' || view.kind === 'friends' || view.kind === 'home'
      ? 'direct-messages'
      : view.kind === 'settings'
        ? 'settings'
        : activeChannel?.type === 'VOICE'
          ? 'voice'
          : 'servers';

  const reloadGuilds = () =>
    client.listGuilds().then((g) => {
      setGuilds(g);
      return g;
    });

  const openChannel = (guildId: string, channelId: string) => {
    rememberChannel(guildId, channelId);
    setView({ kind: 'channel', guildId, channelId });
  };

  const pickChannel = (guildId: string, chs: ChannelSummary[]) => {
    const preferId = readGuildLastChannel(guildId);
    const prefer = preferId ? chs.find((c) => c.id === preferId) : undefined;
    return (
      prefer ??
      chs.find((c) => c.type === 'TEXT') ??
      chs.find((c) => c.type === 'FORUM') ??
      chs.find((c) => c.type === 'VOICE') ??
      chs[0]
    );
  };

  useEffect(() => {
    void reloadGuilds().then((g) => {
      if (!g.length) return;
      const last = readLastChannel();
      if (last && g.some((x) => x.id === last.guildId)) {
        setView({ kind: 'channel', guildId: last.guildId, channelId: last.channelId });
        return;
      }
      void client.getGuildChannels(g[0].id).then((chs) => {
        const first = pickChannel(g[0].id, chs);
        if (first) openChannel(g[0].id, first.id);
      });
    });
  }, [client]);

  useEffect(() => {
    if (!activeGuildId) {
      setChannels([]);
      setMembers([]);
      return;
    }
    void client.getGuildChannels(activeGuildId).then(setChannels);
    void client.getGuildMembers(activeGuildId).then(setMembers).catch(() => setMembers([]));
  }, [client, activeGuildId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const categories = useMemo(
    () =>
      buildSidebarCategories(channels, activeChannelId ?? undefined, (ch) => {
        if (activeGuildId) openChannel(activeGuildId, ch.id);
      }, {
        selfUserId: user?.id,
        collapsedCategoryIds: collapsed,
        onToggleCategory: toggleCollapsed,
        onInviteChannel: () => setInviteOpen(true),
        onOpenVoiceChat: (ch) => {
          if (activeGuildId) openChannel(activeGuildId, ch.id);
        },
      }),
    [channels, activeChannelId, activeGuildId, user?.id, collapsed],
  );

  const railGuilds: ServerRailGuild[] = guilds.map((g) => ({
    id: g.id,
    name: g.name,
    iconUrl: g.iconUrl,
  }));

  const getGuildActions = (guild: ServerRailGuild): ServerRailGuildAction[] => [
    {
      id: 'invite',
      label: 'Davet linki oluştur',
      onSelect: () => {
        void client.createInvite(guild.id).then((inv) => {
          const url = inv.url || inv.code;
          void navigator.clipboard?.writeText(url);
          alert(`Davet kopyalandı:\n${url}`);
        });
      },
    },
    {
      id: 'settings',
      label: 'Sunucu ayarları',
      onSelect: () => setView({ kind: 'guild-settings', guildId: guild.id }),
    },
    {
      id: 'leave',
      label: 'Sunucudan ayrıl',
      danger: true,
      onSelect: () => setLeaveTarget(guild),
    },
  ];

  const isActivity =
    activeChannel?.type === 'GAME' || activeChannel?.type === 'WATCH_PARTY';

  const electronApi = (window as unknown as { electronAPI?: { minimize?: () => void; maximize?: () => void; close?: () => void } }).electronAPI;

  return (
    <div className="flex flex-col h-dvh max-h-dvh w-screen overflow-hidden bg-surface">
      <TitleBar
        activeNav={titleNav}
        subtitle="Dracord"
        onNavClick={(id) => {
          if (id === 'direct-messages') setView({ kind: 'friends' });
          else if (id === 'settings') setView({ kind: 'settings' });
          else if (id === 'voice') {
            const voice = channels.find((c) => c.type === 'VOICE');
            if (voice && activeGuildId) openChannel(activeGuildId, voice.id);
            else setView({ kind: 'home' });
          } else if (guilds[0]) {
            void client.getGuildChannels(guilds[0].id).then((chs) => {
              const first = pickChannel(guilds[0].id, chs);
              if (first) openChannel(guilds[0].id, first.id);
            });
          } else setView({ kind: 'home' });
        }}
        trailing={
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Ara (Ctrl+K)"
              onClick={() => setSearchOpen(true)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
            <NotificationBell onOpenAll={() => setView({ kind: 'notifications' })} />
          </div>
        }
        windowControls={
          electronApi
            ? {
                onMinimize: () => electronApi.minimize?.(),
                onMaximize: () => electronApi.maximize?.(),
                onClose: () => electronApi.close?.(),
              }
            : undefined
        }
      />

      <div className="flex flex-1 min-h-0">
        <ServerRail
          className="h-full"
          guilds={railGuilds}
          activeGuildId={activeGuildId}
          homeActive={view.kind === 'home' || view.kind === 'friends' || view.kind === 'dms'}
          onHomeClick={() => setView({ kind: 'friends' })}
          onGuildClick={(guildId) => {
            void client.getGuildChannels(guildId).then((chs) => {
              const first = pickChannel(guildId, chs);
              if (first) openChannel(guildId, first.id);
            });
          }}
          onAddClick={() => {
            setModalError(null);
            setCreateOpen(true);
          }}
          onExploreClick={() => setView({ kind: 'discover' })}
          getGuildActions={getGuildActions}
        />

        {(view.kind === 'channel' || view.kind === 'guild-settings') && activeGuild && (
          <ChannelSidebar
            className="h-full w-72 shrink-0"
            serverName={activeGuild.name}
            serverBannerUrl={activeGuild.bannerUrl}
            onServerHeaderClick={() =>
              setView({ kind: 'guild-settings', guildId: activeGuild.id })
            }
            categories={categories}
            headerExtra={
              <div className="flex flex-col gap-1 px-2 pb-2">
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  onClick={() => {
                    void client.createInvite(activeGuild.id).then((inv) => {
                      void navigator.clipboard?.writeText(inv.url || inv.code);
                      alert('Davet kopyalandı');
                    });
                  }}
                >
                  İnsanları davet et
                </button>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  onClick={() => setView({ kind: 'guild-settings', guildId: activeGuild.id })}
                >
                  Sunucu ayarları
                </button>
              </div>
            }
            userPanel={{
              displayName: user?.displayName ?? '…',
              username: user?.username,
              avatarUrl: user?.avatarUrl,
              status: user?.status ?? 'ONLINE',
              customStatus: user?.customStatus,
              muted,
              deafened,
              onMicClick: () => setMuted((v) => !v),
              onHeadphonesClick: () => setDeafened((v) => !v),
              onSettingsClick: () => setView({ kind: 'settings' }),
              onProfileClick: () => setView({ kind: 'settings' }),
              selfMenuActions: [
                { id: 'friends', label: 'Arkadaşlar', onSelect: () => setView({ kind: 'friends' }) },
                { id: 'dms', label: 'Direkt mesajlar', onSelect: () => setView({ kind: 'dms' }) },
                { id: 'logout', label: 'Çıkış yap', danger: true, onSelect: () => logout() },
              ],
            }}
          />
        )}

        {(view.kind === 'home' || view.kind === 'friends' || view.kind === 'dms') && (
          <aside className="w-60 shrink-0 bg-surface-container-low border-r border-outline-variant flex flex-col">
            <div className="h-12 px-3 flex items-center font-bold border-b border-outline-variant">
              Draco
            </div>
            <nav className="p-2 flex flex-col gap-0.5">
              <HomeNav
                active={view.kind === 'friends'}
                icon="group"
                label="Arkadaşlar"
                onClick={() => setView({ kind: 'friends' })}
              />
              <HomeNav
                active={view.kind === 'dms'}
                icon="chat"
                label="Direkt mesajlar"
                onClick={() => setView({ kind: 'dms' })}
              />
              <HomeNav icon="search" label="Ara (Ctrl+K)" onClick={() => setSearchOpen(true)} />
              <HomeNav
                icon="explore"
                label="Keşfet"
                onClick={() => setView({ kind: 'discover' })}
              />
            </nav>
            <div className="flex-1" />
            <div className="p-2 border-t border-outline-variant">
              <div className="flex items-center gap-2 px-2 py-2">
                <div
                  className="w-8 h-8 rounded-full bg-surface-container-high bg-cover"
                  style={{
                    backgroundImage: user?.avatarUrl ? `url(${user.avatarUrl})` : undefined,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{user?.displayName}</div>
                  <div className="text-xs text-on-surface-variant truncate">@{user?.username}</div>
                </div>
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          {view.kind === 'channel' && activeChannel?.type === 'TEXT' && (
            <ChatPanel
              guildId={view.guildId}
              channel={activeChannel}
              members={members}
              showMembersToggle={() => setShowMembers((v) => !v)}
            />
          )}
          {view.kind === 'channel' && activeChannel?.type === 'FORUM' && (
            <ChatPanel
              guildId={view.guildId}
              channel={activeChannel}
              members={members}
              showMembersToggle={() => setShowMembers((v) => !v)}
            />
          )}
          {view.kind === 'channel' && activeChannel?.type === 'VOICE' && (
            <VoicePanel
              guildId={view.guildId}
              channel={activeChannel}
              members={members}
              textChannels={channels.filter((c) => c.type === 'TEXT')}
              muted={muted}
              deafened={deafened}
              onMutedChange={setMuted}
              onDeafenedChange={setDeafened}
            />
          )}
          {view.kind === 'channel' && isActivity && activeChannel && (
            <ActivityPanel
              guildId={view.guildId}
              channel={activeChannel}
              members={members}
              textChannels={channels.filter((c) => c.type === 'TEXT')}
            />
          )}
          {view.kind === 'channel' && !activeChannel && (
            <Empty>Kanal yükleniyor…</Empty>
          )}
          {view.kind === 'home' && <Empty>Bir sunucu seç veya arkadaşlarına göz at.</Empty>}
          {view.kind === 'friends' && <FriendsHubView onOpenDm={() => setView({ kind: 'dms' })} />}
          {view.kind === 'dms' && <DmPanel />}
          {view.kind === 'discover' && (
            <DiscoverPage
              onJoined={(id) => {
                void reloadGuilds().then(() =>
                  client.getGuildChannels(id).then((chs) => {
                    const first = pickChannel(id, chs);
                    if (first) openChannel(id, first.id);
                  }),
                );
              }}
            />
          )}
          {view.kind === 'settings' && <SettingsPage onClose={() => setView({ kind: 'friends' })} />}
          {view.kind === 'notifications' && <NotificationsPanel />}
          {view.kind === 'guild-settings' && (
            <GuildSettingsPage
              guildId={view.guildId}
              onBack={() => {
                const ch = channels.find((c) => c.type === 'TEXT') ?? channels[0];
                if (ch) openChannel(view.guildId, ch.id);
                else setView({ kind: 'home' });
              }}
              onChannelsChanged={() => void client.getGuildChannels(view.guildId).then(setChannels)}
            />
          )}
        </main>

        {view.kind === 'channel' &&
          showMembers &&
          (activeChannel?.type === 'TEXT' || activeChannel?.type === 'FORUM') && (
            <MemberPanel
              members={members}
              onOpenDm={(userId) => {
                void client.openDm(userId).then(() => setView({ kind: 'dms' }));
              }}
            />
          )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Sunucu oluştur">
        {modalError && <p className="text-error text-sm mb-2">{modalError}</p>}
        <label className="flex flex-col gap-1 mb-3">
          <span className="text-xs text-on-surface-variant">Sunucu adı</span>
          <input
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface-container-highest text-on-surface outline-none focus:ring-1 focus:ring-primary-container"
          />
        </label>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={discoverable}
            onChange={(e) => setDiscoverable(e.target.checked)}
          />
          Keşfette göster
        </label>
        {discoverable && (
          <div className="mb-3">
            <SearchableSelect
              value={discoverCategory}
              onChange={setDiscoverCategory}
              options={[
                { value: 'gaming', label: 'Oyun' },
                { value: 'music', label: 'Müzik' },
                { value: 'entertainment', label: 'Eğlence' },
                { value: 'tech', label: 'Teknoloji' },
                { value: 'education', label: 'Eğitim' },
              ]}
              placeholder="Kategori"
            />
          </div>
        )}
        <button
          type="button"
          disabled={modalBusy || serverName.trim().length < 2}
          className="w-full h-10 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
          onClick={() => {
            setModalBusy(true);
            setModalError(null);
            void client
              .createGuild({
                name: serverName.trim(),
                discoverable,
                discoverCategory: discoverCategory as
                  | 'gaming'
                  | 'music'
                  | 'entertainment'
                  | 'tech'
                  | 'education',
              })
              .then((g) => {
                setCreateOpen(false);
                setServerName('');
                return reloadGuilds().then(() =>
                  client.getGuildChannels(g.id).then((chs) => {
                    const first = pickChannel(g.id, chs);
                    if (first) openChannel(g.id, first.id);
                  }),
                );
              })
              .catch((e) => setModalError(e instanceof Error ? e.message : 'Hata'))
              .finally(() => setModalBusy(false));
          }}
        >
          Oluştur
        </button>
        <button
          type="button"
          className="w-full mt-2 h-10 rounded-lg bg-surface-container-high text-on-surface"
          onClick={() => {
            setCreateOpen(false);
            setInviteOpen(true);
          }}
        >
          Davet ile katıl
        </button>
      </Modal>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Davet ile katıl">
        {modalError && <p className="text-error text-sm mb-2">{modalError}</p>}
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Davet kodu veya link"
          className="w-full h-10 px-3 rounded-lg bg-surface-container-highest text-on-surface mb-3 outline-none"
        />
        <button
          type="button"
          disabled={modalBusy || !inviteCode.trim()}
          className="w-full h-10 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
          onClick={() => {
            setModalBusy(true);
            setModalError(null);
            const raw = inviteCode.trim();
            const code = raw.includes('/') ? raw.split('/').pop()! : raw;
            void client
              .joinInvite(code)
              .then((g) => {
                setInviteOpen(false);
                setInviteCode('');
                return reloadGuilds().then(() =>
                  client.getGuildChannels(g.id).then((chs) => {
                    const first = pickChannel(g.id, chs);
                    if (first) openChannel(g.id, first.id);
                  }),
                );
              })
              .catch((e) => setModalError(e instanceof Error ? e.message : 'Katılınamadı'))
              .finally(() => setModalBusy(false));
          }}
        >
          Katıl
        </button>
      </Modal>

      <ConfirmDialog
        open={Boolean(leaveTarget)}
        title="Sunucudan ayrıl"
        description={`${leaveTarget?.name ?? ''} sunucusundan ayrılmak istiyor musun?`}
        confirmLabel="Ayrıl"
        danger
        onCancel={() => setLeaveTarget(null)}
        onConfirm={() => {
          if (!leaveTarget) return;
          void client.leaveGuild(leaveTarget.id).then(async () => {
            setLeaveTarget(null);
            const g = await reloadGuilds();
            if (g[0]) {
              const chs = await client.getGuildChannels(g[0].id);
              const first = pickChannel(g[0].id, chs);
              if (first) openChannel(g[0].id, first.id);
              else setView({ kind: 'home' });
            } else setView({ kind: 'home' });
          });
        }}
      />

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenChannel={openChannel}
      />
    </div>
  );
}

function HomeNav({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold ${
        active
          ? 'bg-surface-container-high text-on-surface'
          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      {label}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid place-items-center h-full text-on-surface-variant">{children}</div>
  );
}
