import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_CHANNEL_KEY = 'dracord.mobile.lastChannel';
const LAST_BY_GUILD_KEY = 'dracord.mobile.lastChannelByGuild';

export async function rememberChannel(guildId: string, channelId: string) {
  try {
    await AsyncStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify({ guildId, channelId }));
    const raw = await AsyncStorage.getItem(LAST_BY_GUILD_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[guildId] = channelId;
    await AsyncStorage.setItem(LAST_BY_GUILD_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export async function readLastChannel(): Promise<{ guildId: string; channelId: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_CHANNEL_KEY);
    return raw ? (JSON.parse(raw) as { guildId: string; channelId: string }) : null;
  } catch {
    return null;
  }
}

export async function readGuildLastChannel(guildId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_BY_GUILD_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as Record<string, string>)[guildId] ?? null;
  } catch {
    return null;
  }
}
