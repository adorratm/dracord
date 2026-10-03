import type { CategoryDto, ChannelSummary, GuildSummary } from '@dracord/types';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

type GuildNavSnapshot = {
  guilds: GuildSummary[];
  guild: GuildSummary | null;
  channels: ChannelSummary[];
  categories: CategoryDto[];
};

/** Sayfa remount / kanal geçişinde “Sunucu yükleniyor” flaşını önler. */
const guildNavCache = new Map<string, GuildNavSnapshot>();

export function invalidateGuildNavCache(guildId?: string) {
  if (guildId) guildNavCache.delete(guildId);
  else guildNavCache.clear();
}

function readCache(guildId: string | undefined): GuildNavSnapshot | undefined {
  if (!guildId) return undefined;
  return guildNavCache.get(guildId);
}

function writeCache(guildId: string, snap: GuildNavSnapshot) {
  guildNavCache.set(guildId, snap);
}

export function useGuildNav(guildId: string | undefined) {
  const { client, user } = useAuth();
  const cached = readCache(guildId);
  const [guilds, setGuilds] = useState<GuildSummary[]>(cached?.guilds ?? []);
  const [guild, setGuild] = useState<GuildSummary | null>(cached?.guild ?? null);
  const [channels, setChannels] = useState<ChannelSummary[]>(cached?.channels ?? []);
  const [categories, setCategories] = useState<CategoryDto[]>(cached?.categories ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const applySnapshot = useCallback(
    (list: GuildSummary[], ch: ChannelSummary[], cats: CategoryDto[]) => {
      const nextGuild = guildId ? (list.find((x) => x.id === guildId) ?? null) : null;
      setGuilds(list);
      setGuild(nextGuild);
      setChannels(ch);
      setCategories(cats);
      setError(null);
      if (guildId) {
        writeCache(guildId, {
          guilds: list,
          guild: nextGuild,
          channels: ch,
          categories: cats,
        });
      }
    },
    [guildId],
  );

  const reload = useCallback(async () => {
    if (!user) return;
    const soft = Boolean(readCache(guildId)) || guilds.length > 0;
    if (!soft) setLoading(true);
    setError(null);
    try {
      const list = await client.listGuilds();
      let ch: ChannelSummary[] = [];
      let cats: CategoryDto[] = [];
      if (guildId) {
        [ch, cats] = await Promise.all([
          client.getGuildChannels(guildId),
          client.listGuildCategories(guildId).catch(() => [] as CategoryDto[]),
        ]);
      }
      applySnapshot(list, ch, cats);
    } catch (e) {
      if (guildId) invalidateGuildNavCache(guildId);
      setError(e instanceof Error ? e.message : 'Sunucu yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [client, guildId, user, guilds.length, applySnapshot]);

  const patchGuild = useCallback(
    (next: GuildSummary) => {
      setGuild(next);
      setGuilds((prev) => {
        const guildsNext = prev.map((g) => (g.id === next.id ? next : g));
        if (guildId) {
          writeCache(guildId, {
            guilds: guildsNext,
            guild: next,
            channels: readCache(guildId)?.channels ?? channels,
            categories: readCache(guildId)?.categories ?? categories,
          });
        }
        return guildsNext;
      });
    },
    [guildId, channels, categories],
  );

  /** Okunmamış sayacı: absolute=true ise count değerine set, değilse delta ekle */
  const patchChannelUnread = useCallback(
    (targetChannelId: string, countOrDelta: number, absolute = false) => {
      setChannels((prev) => {
        const next = prev.map((ch) => {
          if (ch.id !== targetChannelId) return ch;
          const unreadCount = Math.max(
            0,
            absolute ? countOrDelta : (ch.unreadCount ?? 0) + countOrDelta,
          );
          return { ...ch, unreadCount, unread: unreadCount > 0 };
        });
        if (guildId) {
          const hit = readCache(guildId);
          writeCache(guildId, {
            guilds: hit?.guilds ?? guilds,
            guild: hit?.guild ?? guild,
            channels: next,
            categories: hit?.categories ?? categories,
          });
        }
        return next;
      });
    },
    [guildId, guilds, guild, categories],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const hit = readCache(guildId);
    if (!hit) setLoading(true);
    setError(null);
    void (async () => {
      try {
        const list = await client.listGuilds();
        if (cancelled) return;
        let ch: ChannelSummary[] = hit?.channels ?? [];
        let cats: CategoryDto[] = hit?.categories ?? [];
        if (guildId) {
          [ch, cats] = await Promise.all([
            client.getGuildChannels(guildId),
            client.listGuildCategories(guildId).catch(() => [] as CategoryDto[]),
          ]);
        }
        if (cancelled) return;
        applySnapshot(list, ch, cats);
      } catch (e) {
        if (cancelled) return;
        if (guildId) invalidateGuildNavCache(guildId);
        setError(e instanceof Error ? e.message : 'Sunucu yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, guildId, user, applySnapshot]);

  return {
    guilds,
    guild,
    channels,
    categories,
    loading,
    error,
    reload,
    patchGuild,
    patchChannelUnread,
  };
}
