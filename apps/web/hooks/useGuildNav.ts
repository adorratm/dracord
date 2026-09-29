'use client';

import type { ChannelSummary, GuildSummary } from '@dracord/types';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

export function useGuildNav(guildId: string | undefined) {
  const { client, user } = useAuth();
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    const soft = guilds.length > 0;
    if (!soft) setLoading(true);
    try {
      const list = await client.listGuilds();
      setGuilds(list);
      if (guildId) {
        setGuild(list.find((x) => x.id === guildId) ?? null);
        const ch = await client.getGuildChannels(guildId);
        setChannels(ch);
      }
    } finally {
      setLoading(false);
    }
  }, [client, guildId, user, guilds.length]);

  const patchGuild = useCallback((next: GuildSummary) => {
    setGuild(next);
    setGuilds((prev) => prev.map((g) => (g.id === next.id ? next : g)));
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const list = await client.listGuilds();
        if (cancelled) return;
        setGuilds(list);
        if (guildId) {
          setGuild(list.find((x) => x.id === guildId) ?? null);
          const ch = await client.getGuildChannels(guildId);
          if (!cancelled) setChannels(ch);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, guildId, user]);

  return { guilds, guild, channels, loading, reload, patchGuild };
}
