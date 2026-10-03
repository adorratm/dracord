'use client';

import type { TitleBarNavId } from '@dracord/ui';
import {
  Modal,
  ServerRail,
  TitleBar,
  type ServerRailGuild,
  type ServerRailGuildAction,
} from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AppTour } from '@/components/AppTour';
import { NotificationBell } from '@/components/NotificationBell';
import { invalidateGuildNavCache } from '@/hooks/useGuildNav';

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
  const { client, user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [serverName, setServerName] = useState('');
  const [discoverable, setDiscoverable] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [discover, setDiscover] = useState<ServerRailGuild[]>([]);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serversOpen, setServersOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<ServerRailGuild | null>(null);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  /** Ayrılma sonrası parent reload olana kadar rayı anında güncelle */
  const [guildsOverride, setGuildsOverride] = useState<ServerRailGuild[] | null>(null);

  useEffect(() => {
    setGuildsOverride(null);
  }, [guilds]);

  const displayGuilds = guildsOverride ?? guilds;

  const openGuild = useCallback(
    async (guildId: string) => {
      invalidateGuildNavCache(guildId);
      try {
        let channels = await client.getGuildChannels(guildId);
        // İlk istek boş dönerse (üyelik/izin race) bir kez daha dene
        if (!channels.length) {
          await new Promise((r) => setTimeout(r, 250));
          channels = await client.getGuildChannels(guildId);
        }
        const text =
          channels.find((c) => c.type === 'TEXT') ??
          channels.find((c) => c.type === 'FORUM') ??
          channels.find((c) => c.type === 'VOICE') ??
          channels[0];
        if (text) {
          rememberChannel(guildId, text.id);
          router.push(`/channels/${guildId}/${text.id}`);
          return;
        }
        setError('Bu sunucuda görüntülenebilir kanal yok.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sunucu açılamadı');
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
    if (!exploreOpen) {
      setDiscoverQuery('');
      return;
    }
    const t = window.setTimeout(() => {
      void client
        .discoverGuilds(discoverQuery.trim() || undefined)
        .then(setDiscover)
        .catch(() => setDiscover([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [exploreOpen, discoverQuery, client]);

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
      setGuildsOverride((prev) => {
        const base = prev ?? guilds;
        if (base.some((g) => g.id === guild.id)) return base;
        return [...base, guild];
      });
      invalidateGuildNavCache();
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
      setGuildsOverride((prev) => {
        const base = prev ?? guilds;
        if (base.some((g) => g.id === guild.id)) return base;
        return [...base, guild];
      });
      invalidateGuildNavCache(guild.id);
      onGuildsChanged?.();
      await openGuild(guild.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Davet geçersiz');
    } finally {
      setBusy(false);
    }
  };

  const createGuildInvite = useCallback(
    async (guildId: string) => {
      setBusy(true);
      setError(null);
      try {
        const invite = await client.createInvite(guildId);
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const url = `${origin}/invite/${invite.code}`;
        setCreatedInviteUrl(url);
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // panoya yazılamazsa modal yine gösterilir
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Davet oluşturulamadı');
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  const leaveGuild = useCallback(async () => {
    if (!leaveTarget) return;
    setBusy(true);
    setError(null);
    try {
      const leftId = leaveTarget.id;
      await client.leaveGuild(leftId);
      setLeaveTarget(null);
      invalidateGuildNavCache(leftId);
      setGuildsOverride((prev) => (prev ?? guilds).filter((g) => g.id !== leftId));
      onGuildsChanged?.();
      if (activeGuildId === leftId) {
        router.push('/channels/@me');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sunucudan ayrılınamadı');
    } finally {
      setBusy(false);
    }
  }, [leaveTarget, client, onGuildsChanged, activeGuildId, router, guilds]);

  const getGuildActions = useCallback(
    (guild: ServerRailGuild): ServerRailGuildAction[] => {
      const isOwner = Boolean(user?.id && guild.ownerId && guild.ownerId === user.id);
      const actions: ServerRailGuildAction[] = [
        {
          id: 'invite',
          label: 'Davet oluştur',
          onSelect: () => {
            setServersOpen(false);
            void createGuildInvite(guild.id);
          },
        },
        {
          id: 'settings',
          label: 'Sunucu ayarları',
          onSelect: () => {
            setServersOpen(false);
            router.push(`/guilds/${guild.id}/settings`);
          },
        },
      ];
      if (!isOwner) {
        actions.push({
          id: 'leave',
          label: 'Sunucudan ayrıl',
          danger: true,
          onSelect: () => {
            setServersOpen(false);
            setError(null);
            setLeaveTarget(guild);
          },
        });
      }
      return actions;
    },
    [user?.id, createGuildInvite, router],
  );

  const serverRailProps = {
    guilds: displayGuilds,
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
    getGuildActions,
  };

  return (
    <div className="flex flex-col h-dvh max-h-dvh w-screen overflow-hidden bg-surface">
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
        <input
          value={discoverQuery}
          onChange={(e) => setDiscoverQuery(e.target.value)}
          className="w-full h-10 px-space-sm mb-space-sm rounded-lg bg-surface-container-highest text-on-surface outline-none"
          placeholder="Sunucu ara…"
          autoFocus
        />
        <div className="flex flex-col gap-space-sm max-h-80 overflow-y-auto">
          {discover.length === 0 && (
            <p className="text-on-surface-variant font-body-sm">
              {discoverQuery.trim()
                ? 'Eşleşen sunucu yok.'
                : 'Keşfedilebilir sunucu yok.'}
            </p>
          )}
          {discover.map((g) => (
            <button
              key={g.id}
              type="button"
              className="flex items-center justify-between px-space-sm py-space-sm rounded-lg hover:bg-surface-container text-left transition-colors"
              onClick={() => {
                void (async () => {
                  try {
                    setBusy(true);
                    setError(null);
                    const joined = await client.joinDiscoverableGuild(g.id);
                    setGuildsOverride((prev) => {
                      const base = prev ?? guilds;
                      if (base.some((x) => x.id === joined.id)) return base;
                      return [...base, joined];
                    });
                    invalidateGuildNavCache(joined.id);
                    onGuildsChanged?.();
                    setExploreOpen(false);
                    await openGuild(joined.id);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Katılınamadı');
                  } finally {
                    setBusy(false);
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

      <Modal
        open={Boolean(createdInviteUrl)}
        title="Davet linki"
        onClose={() => setCreatedInviteUrl(null)}
        footer={
          <button
            type="button"
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container"
            onClick={() => {
              if (createdInviteUrl) {
                void navigator.clipboard.writeText(createdInviteUrl).catch(() => undefined);
              }
              setCreatedInviteUrl(null);
            }}
          >
            Kopyala ve kapat
          </button>
        }
      >
        <p className="font-body-sm text-on-surface-variant mb-space-sm">
          Link panoya kopyalandı (destekleniyorsa). Paylaşmak için:
        </p>
        <input
          readOnly
          value={createdInviteUrl ?? ''}
          className="w-full h-10 px-space-sm rounded-lg bg-surface-container-highest text-on-surface outline-none"
          onFocus={(e) => e.currentTarget.select()}
        />
      </Modal>

      <Modal
        open={Boolean(leaveTarget)}
        title="Sunucudan ayrıl"
        onClose={() => {
          if (!busy) {
            setLeaveTarget(null);
            setError(null);
          }
        }}
        footer={
          <>
            <button
              type="button"
              disabled={busy}
              className="px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
              onClick={() => {
                setLeaveTarget(null);
                setError(null);
              }}
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-space-md py-space-sm rounded-lg bg-error text-on-error hover:opacity-90 transition-opacity disabled:opacity-50"
              onClick={() => void leaveGuild()}
            >
              Ayrıl
            </button>
          </>
        }
      >
        <p className="font-body-md text-on-surface">
          <strong>{leaveTarget?.name}</strong> sunucusundan ayrılmak istediğine emin misin?
        </p>
        <p className="mt-space-sm font-body-sm text-on-surface-variant">
          Yeniden katılmak için davet gerekir.
        </p>
        {error && <p className="mt-space-sm text-error font-body-sm">{error}</p>}
      </Modal>
    </div>
  );
}
