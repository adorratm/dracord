const LAST_CHANNEL_KEY = 'dracord.desktop.lastChannel';
const LAST_BY_GUILD_KEY = 'dracord.desktop.lastChannelByGuild';

export function rememberChannel(guildId: string, channelId: string) {
  try {
    localStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify({ guildId, channelId }));
    const raw = localStorage.getItem(LAST_BY_GUILD_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[guildId] = channelId;
    localStorage.setItem(LAST_BY_GUILD_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readLastChannel(): { guildId: string; channelId: string } | null {
  try {
    const raw = localStorage.getItem(LAST_CHANNEL_KEY);
    return raw ? (JSON.parse(raw) as { guildId: string; channelId: string }) : null;
  } catch {
    return null;
  }
}

export function readGuildLastChannel(guildId: string): string | null {
  try {
    const raw = localStorage.getItem(LAST_BY_GUILD_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as Record<string, string>)[guildId] ?? null;
  } catch {
    return null;
  }
}
