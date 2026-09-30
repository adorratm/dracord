'use client';

import type { TitleBarNavId } from '@dracord/ui';
import { Modal, ServerRail, TitleBar, type ServerRailGuild } from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AppTour } from '@/components/AppTour';
import { NotificationBell } from '@/components/NotificationBell';

const LAST_CHANNEL_KEY = 'dracord:last-channel';

export function rememberChannel(guildId: string, channelId: string) {
  try {
    localStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify({ guildId, channelId }));
  } catch {
    // ignore
  }
}

export function readLastChannel(): { guildId: string; channelId: string } | null {
  try {
    const raw = localStorage.getItem(LAST_CHANNEL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { guildId: string; channelId: string };
  } catch {
    return null;
  }
}

export interface AppShellProps {
  children: ReactNode;
  guilds?: ServerRailGuild[];
  activeGuildId?: string | null;
  homeActive?: boolean;
  showServerRail?: boolean;
  titleBarNav?: TitleBarNavId;
  subtitle?: string;
  onGuildsChanged?: () => void;
}

export function AppShell({
  children,
  guilds = [],
  activeGuildId,
  homeActive = false,
  showServerRail = true,
  titleBarNav = 'servers',
  subtitle = 'Dracord',
  onGuildsChanged,
}: AppShellProps) {
  const router = useRouter();
  const { client } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [serverName, setServerName] = useState('');
  const [discoverable, setDiscoverable] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [discover, setDiscover] = useState<ServerRailGuild[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serversOpen, setServersOpen] = useState(false);

  const openGuild = useCallback(
    async (guildId: string) => {
      try {
        const channels = await client.getGuildChannels(guildId);
        const text = channels.find((c) => c.type === 'TEXT') ?? channels[0];
        if (text) {
          rememberChannel(guildId, text.id);
          router.push(`/channels/${guildId}/${text.id}`);
        }
      } catch {
        router.push(`/channels/${guildId}`);
      } finally {
        setServersOpen(false);
      }
    },
    [client, router],
  );

  const onNavClick = useCallback(
    (id: TitleBarNavId) => {
      if (id === 'direct-messages') {
        router.push('/channels/@me');
        return;
      }
      if (id === 'settings') {
        router.push('/settings');
        return;
      }
      if (id === 'servers') {
        const last = readLastChannel();
        if (last) {
          router.push(`/channels/${last.guildId}/${last.channelId}`);
          return;
        }
        if (guilds[0]) void openGuild(guilds[0].id);
        else router.push('/channels/@me');
        return;
      }
      if (id === 'voice') {
        const last = readLastChannel();
        if (last) {
          void (async () => {
            try {
              const channels = await client.getGuildChannels(last.guildId);
              const voice =
                channels.find((c) => c.id === last.channelId && c.type === 'VOICE') ??
                channels.find((c) => c.type === 'VOICE');
              if (voice) {
                router.push(`/channels/${last.guildId}/${voice.id}`);
                return;
              }
            } catch {
              // fall through
            }
            router.push(`/channels/${last.guildId}/${last.channelId}`);
          })();
          return;
        }
        router.push('/channels/@me');
      }
    },
    [router, guilds, openGuild, client],
  );

  useEffect(() => {
    if (!exploreOpen) return;
    void client.discoverGuilds().then(setDiscover).catch(() => setDiscover([]));
  }, [exploreOpen, client]);

  const createServer = async () => {
    setBusy(true);
    setError(null);
    try {
      const guild = await client.createGuild({
        name: serverName.trim() || 'Yeni sunucu',
        discoverable,
      });
      setCreateOpen(false);
      setServerName('');
      onGuildsChanged?.();
      await openGuild(guild.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sunucu oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  const joinInvite = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = inviteCode.trim().split('/').pop() ?? '';
      const guild = await client.joinInvite(code);
      setInviteOpen(false);
      setInviteCode('');
      onGuildsChanged?.();
      await openGuild(guild.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Davet geçersiz');
    } finally {
      setBusy(false);
    }
  };

  const serverRailProps = {
    guilds,
    activeGuildId,
    homeActive,
    onHomeClick: () => {
      setServersOpen(false);
      router.push('/channels/@me');
    },
    onGuildClick: (guildId: string) => void openGuild(guildId),
    onAddClick: () => {
      setError(null);
      setServersOpen(false);
      setCreateOpen(true);
    },
    onExploreClick: () => {
      setError(null);
      setServersOpen(false);
      setExploreOpen(true);
    },
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface">
      <div data-tour="nav">
        <TitleBar
          activeNav={titleBarNav}
          subtitle={subtitle}
          onNavClick={onNavClick}
          leading={
            showServerRail ? (
              <button
                type="button"
                className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                aria-label="Sunucular"
                onClick={() => setServersOpen(true)}
              >
                <span className="material-symbols-outlined text-[20px]">menu</span>
              </button>
            ) : undefined
          }
          trailing={
            <div data-tour="notifications">
              <NotificationBell />
            </div>
          }
        />
      </div>
      <div className="flex flex-1 min-h-0">
        {showServerRail && (
          <div data-tour="servers" className="hidden md:flex h-full relative z-0">
            <ServerRail {...serverRailProps} className="h-full" />
          </div>
        )}
        {/* Mobil: sunucu rayı ana alanı daraltır (push); diğer menüler overlay kalır */}
        {showServerRail && serversOpen && (
          <div className="md:hidden flex h-full shrink-0 relative z-10 border-r border-surface-container-high">
            <ServerRail {...serverRailProps} className="h-full" />
          </div>
        )}
        <div className="flex flex-1 min-w-0 min-h-0 overflow-visible" data-tour="chat">
          {children}
        </div>
      </div>

      {showServerRail && serversOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-[5] bg-transparent"
          aria-label="Sunucu menüsünü kapat"
          onClick={() => setServersOpen(false)}
        />
      )}

      <AppTour />
      <Modal
        open={createOpen}
        title="Sunucu oluştur"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
              onClick={() => {
                setCreateOpen(false);
                setInviteOpen(true);
              }}
            >
              Davet ile katıl
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container hover:bg-primary transition-colors disabled:opacity-50"
              onClick={() => void createServer()}
            >
              Oluştur
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-space-xs mb-space-md">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Sunucu adı</span>
          <input
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest text-on-surface outline-none focus:ring-1 focus:ring-primary-container"
            placeholder="Dracula Alemi"
          />
        </label>
        <label className="flex items-center gap-space-sm text-on-surface font-body-sm">
          <input
            type="checkbox"
            checked={discoverable}
            onChange={(e) => setDiscoverable(e.target.checked)}
          />
          Keşfette göster
        </label>
        {error && <p className="mt-space-sm text-error font-body-sm">{error}</p>}
      </Modal>

      <Modal
        open={inviteOpen}
        title="Davet ile katıl"
        onClose={() => setInviteOpen(false)}
        footer={
          <button
            type="button"
            disabled={busy || !inviteCode.trim()}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => void joinInvite()}
          >
            Katıl
          </button>
        }
      >
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="w-full h-10 px-space-sm rounded-lg bg-surface-container-highest text-on-surface outline-none"
          placeholder="Davet kodu veya link"
        />
        {error && <p className="mt-space-sm text-error font-body-sm">{error}</p>}
      </Modal>

      <Modal open={exploreOpen} title="Sunucu keşfet" onClose={() => setExploreOpen(false)}>
        <div className="flex flex-col gap-space-sm max-h-80 overflow-y-auto">
          {discover.length === 0 && (
            <p className="text-on-surface-variant font-body-sm">Keşfedilebilir sunucu yok.</p>
          )}
          {discover.map((g) => (
            <button
              key={g.id}
              type="button"
              className="flex items-center justify-between px-space-sm py-space-sm rounded-lg hover:bg-surface-container text-left transition-colors"
              onClick={() => {
                void (async () => {
                  try {
                    await client.joinDiscoverableGuild(g.id);
                    onGuildsChanged?.();
                    setExploreOpen(false);
                    await openGuild(g.id);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Katılınamadı');
                  }
                })();
              }}
            >
              <span className="font-body-md text-on-surface">{g.name}</span>
              <span className="material-symbols-outlined text-outline text-[18px]">chevron_right</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mt-space-md w-full h-10 rounded-lg bg-surface-container-high text-on-surface"
          onClick={() => {
            setExploreOpen(false);
            setInviteOpen(true);
          }}
        >
          Davet kodu ile katıl
        </button>
      </Modal>
    </div>
  );
}
