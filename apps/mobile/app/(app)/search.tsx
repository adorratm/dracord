import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ChannelSummary, GuildSummary, SearchHit } from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { rememberChannel } from '../../lib/lastChannel';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { inputStyle, primaryBtn, primaryBtnText } from '../../lib/ui';
import { ShellHeader, useAppShellOptional } from '../../components/shell/AppShell';
import { Icon } from '../../components/Icon';
import { UserAvatar } from '../../components/UserAvatar';

type Scope = 'all' | 'people' | 'servers' | 'messages';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'people', label: 'Kişiler' },
  { id: 'servers', label: 'Sunucu / kanal' },
  { id: 'messages', label: 'Mesajlar' },
];

function typesForScope(scope: Scope): string[] {
  if (scope === 'people') return ['users'];
  if (scope === 'servers') return ['guilds', 'channels'];
  if (scope === 'messages') return ['messages'];
  return ['guilds', 'channels', 'users', 'messages'];
}

/** ES yoksa /search 503 verdiğinde yerel API ile yedek */
async function fallbackSearch(
  client: {
    searchUsers: (q: string) => Promise<import('@dracord/types').PublicUser[]>;
    listGuilds: () => Promise<GuildSummary[]>;
    getGuildChannels: (id: string) => Promise<ChannelSummary[]>;
  },
  q: string,
  scope: Scope,
  shell: { guildId: string | null; channels: ChannelSummary[] } | null,
): Promise<SearchHit[]> {
  const ql = q.toLowerCase();
  const hits: SearchHit[] = [];

  if (scope === 'all' || scope === 'people') {
    const users = await client.searchUsers(q).catch(() => []);
    for (const u of users) {
      hits.push({
        type: 'user',
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      });
    }
  }

  if (scope === 'all' || scope === 'servers') {
    const guilds = await client.listGuilds().catch(() => [] as GuildSummary[]);
    for (const g of guilds) {
      if (g.name.toLowerCase().includes(ql)) {
        hits.push({
          type: 'guild',
          id: g.id,
          name: g.name,
          iconUrl: g.iconUrl ?? null,
        });
      }
    }

    // Açık sunucu kanalları + isim eşleşen birkaç sunucunun kanalları
    const channelSources: { guildId: string; channels: ChannelSummary[] }[] = [];
    if (shell?.guildId && shell.channels.length) {
      channelSources.push({ guildId: shell.guildId, channels: shell.channels });
    }
    for (const g of guilds.filter((x) => x.name.toLowerCase().includes(ql)).slice(0, 5)) {
      if (shell?.guildId === g.id) continue;
      try {
        channelSources.push({ guildId: g.id, channels: await client.getGuildChannels(g.id) });
      } catch {
        /* ignore */
      }
    }

    const seen = new Set<string>();
    for (const src of channelSources) {
      for (const c of src.channels) {
        if (c.type === 'CATEGORY') continue;
        if (!c.name.toLowerCase().includes(ql)) continue;
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        hits.push({
          type: 'channel',
          id: c.id,
          guildId: src.guildId,
          name: c.name,
          channelType: c.type,
        });
      }
    }
  }

  return hits.slice(0, 40);
}

export default function SearchScreen() {
  const { client } = useAuth();
  const router = useRouter();
  const shell = useAppShellOptional();
  const params = useLocalSearchParams<{
    scope?: string;
    channelId?: string;
    guildId?: string;
  }>();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>(() =>
    params.scope === 'messages' ? 'messages' : 'all',
  );
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genRef = useRef(0);

  const runSearch = useCallback(
    async (query: string, nextScope: Scope) => {
      const trimmed = query.trim();
      if (trimmed.length < 1) {
        setHits([]);
        setSearched(false);
        setError(null);
        setUsedFallback(false);
        setBusy(false);
        return;
      }

      const gen = ++genRef.current;
      setBusy(true);
      setSearched(true);
      setError(null);

      try {
        const channelFilter =
          typeof params.channelId === 'string' ? params.channelId : undefined;
        const guildFilter =
          (typeof params.guildId === 'string' && params.guildId
            ? params.guildId
            : null) || shell?.guildId || undefined;
        const r = await client.search({
          q: trimmed,
          types: typesForScope(nextScope),
          // Mesaj: kanal paramı veya mevcut sunucu
          guildId:
            nextScope === 'messages' && !channelFilter ? guildFilter : undefined,
          channelId: nextScope === 'messages' ? channelFilter : undefined,
          limit: 40,
        });
        if (gen !== genRef.current) return;
        setHits(r.hits ?? []);
        setUsedFallback(false);
      } catch (e) {
        // Elasticsearch kapalıysa kullanıcı/sunucu/kanal yedeği
        try {
          const fb = await fallbackSearch(
            client,
            trimmed,
            nextScope,
            shell
              ? { guildId: shell.guildId, channels: shell.channels }
              : null,
          );
          if (gen !== genRef.current) return;
          if (nextScope === 'messages') {
            setHits([]);
            setError(
              e instanceof Error
                ? e.message
                : 'Mesaj araması şu an kullanılamıyor',
            );
            setUsedFallback(false);
          } else {
            setHits(fb);
            setUsedFallback(true);
            setError(null);
          }
        } catch {
          if (gen !== genRef.current) return;
          setHits([]);
          setError(e instanceof Error ? e.message : 'Arama başarısız');
          setUsedFallback(false);
        }
      } finally {
        if (gen === genRef.current) setBusy(false);
      }
    },
    [client, shell, params.channelId, params.guildId],
  );

  // Yazarken canlı ara (web ile aynı)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(q, scope);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, scope, runSearch]);

  const openHit = async (hit: SearchHit) => {
    if (hit.type === 'guild') {
      try {
        const channels = await client.getGuildChannels(hit.id);
        const text =
          channels.find((c) => c.type === 'TEXT') ??
          channels.find((c) => c.type !== 'CATEGORY');
        if (text) {
          await rememberChannel(hit.id, text.id);
          router.push(`/(app)/channels/${hit.id}/${text.id}`);
          return;
        }
      } catch {
        /* ignore */
      }
      void shell?.selectGuild(hit.id, { openFirst: false });
      router.push('/(app)/guilds');
      return;
    }

    if (hit.type === 'channel') {
      if (hit.guildId) {
        await rememberChannel(hit.guildId, hit.id);
        if (hit.channelType === 'VOICE') {
          router.push(`/(app)/voice/${hit.guildId}/${hit.id}`);
        } else if (hit.channelType === 'GAME' || hit.channelType === 'WATCH_PARTY') {
          router.push(`/(app)/activity/${hit.guildId}/${hit.id}`);
        } else {
          router.push(`/(app)/channels/${hit.guildId}/${hit.id}`);
        }
      }
      return;
    }

    if (hit.type === 'user') {
      if (hit.id === DRACORD_BOT_USER_ID) return;
      try {
        const dm = await client.openDm(hit.id);
        router.push('/(app)/dms');
        // DM listesinde açılsın diye id’yi hatırlat — dms ekranı listeyi yeniler
        await rememberChannel('me', dm.id);
      } catch {
        router.push('/(app)/friends');
      }
      return;
    }

    // message → kanala around ile git
    if (hit.type === 'message') {
      const around = hit.threadRootId || hit.id;
      if (hit.guildId && hit.channelId) {
        await rememberChannel(hit.guildId, hit.channelId);
        router.push({
          pathname: `/(app)/channels/${hit.guildId}/${hit.channelId}`,
          params: { around },
        });
        return;
      }
      if (hit.channelId || hit.dmChannelId) {
        const dmId = hit.dmChannelId || hit.channelId;
        await rememberChannel('me', dmId);
        router.push({ pathname: '/(app)/dms', params: { channelId: dmId, around } });
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title="Ara" />

      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1, position: 'relative' }}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Kullanıcı, kanal, sunucu, mesaj…"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, paddingLeft: 40 }}
              returnKeyType="search"
              onSubmitEditing={() => void runSearch(q, scope)}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
            <View style={{ position: 'absolute', left: 12, top: 12 }}>
              <Icon name="search" size={20} color={colors.textMuted} />
            </View>
          </View>
          <Pressable
            style={primaryBtn}
            onPress={() => void runSearch(q, scope)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryOn} />
            ) : (
              <Text style={primaryBtnText}>Ara</Text>
            )}
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {SCOPES.map((s) => {
            const active = scope === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setScope(s.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 10,
                  backgroundColor: active ? colors.primary : colors.surfaceHigh,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.primaryOn : colors.text,
                    fontWeight: '700',
                    fontSize: 12,
                  }}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
        ) : null}
        {usedFallback ? (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            Gelişmiş arama servisi kapalı — kişiler ve sunucular yerel arandı.
          </Text>
        ) : null}
      </View>

      <FlatList
        style={{ flex: 1, marginTop: 8 }}
        data={hits}
        keyExtractor={(h) => `${h.type}-${h.id}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 8, flexGrow: 1 }}
        ListEmptyComponent={
          searched && !busy ? (
            <View style={{ alignItems: 'center', paddingTop: 48, gap: 8 }}>
              <Icon name="search_off" size={36} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                {q.trim() ? 'Sonuç yok' : 'Aramak için yazmaya başla'}
              </Text>
            </View>
          ) : !searched && !busy ? (
            <View style={{ alignItems: 'center', paddingTop: 48, gap: 8 }}>
              <Icon name="travel_explore" size={36} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 }}>
                Sunucu, kanal, kullanıcı veya mesaj ara
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item: hit }) => (
          <HitRow hit={hit} onPress={() => void openHit(hit)} />
        )}
      />
    </View>
  );
}

function HitRow({ hit, onPress }: { hit: SearchHit; onPress: () => void }) {
  if (hit.type === 'user') {
    return (
      <Pressable onPress={onPress} style={rowStyle}>
        <UserAvatar displayName={hit.displayName} imageUrl={hit.avatarUrl} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={titleStyle} numberOfLines={1}>
            {hit.displayName}
          </Text>
          <Text style={subStyle}>@{hit.username}</Text>
        </View>
        <Icon name="chat" size={18} color={colors.primary} />
      </Pressable>
    );
  }

  if (hit.type === 'guild') {
    return (
      <Pressable onPress={onPress} style={rowStyle}>
        <GuildIcon name={hit.name} iconUrl={hit.iconUrl} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={titleStyle} numberOfLines={1}>
            {hit.name}
          </Text>
          <Text style={subStyle}>Sunucu</Text>
        </View>
        <Icon name="chevron_right" size={20} color={colors.textMuted} />
      </Pressable>
    );
  }

  if (hit.type === 'channel') {
    const icon =
      hit.channelType === 'VOICE'
        ? 'volume_up'
        : hit.channelType === 'GAME' || hit.channelType === 'WATCH_PARTY'
          ? 'sports_esports'
          : 'tag';
    return (
      <Pressable onPress={onPress} style={rowStyle}>
        <View style={iconBox}>
          <Icon name={icon} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={titleStyle} numberOfLines={1}>
            #{hit.name}
          </Text>
          <Text style={subStyle}>{hit.guildId ? 'Kanal' : 'DM'}</Text>
        </View>
        <Icon name="chevron_right" size={20} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={rowStyle}>
      <View style={iconBox}>
        <Icon name="chat_bubble" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={titleStyle} numberOfLines={2}>
          {hit.snippet || hit.content}
        </Text>
        <Text style={subStyle}>
          {hit.authorName}
          {hit.createdAt ? ` · ${new Date(hit.createdAt).toLocaleDateString('tr-TR')}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

function GuildIcon({ name, iconUrl }: { name: string; iconUrl?: string | null }) {
  const uri = resolveMediaUrl(iconUrl);
  if (uri) {
    return (
      <UserAvatar displayName={name} imageUrl={uri} size={40} statusRing={false} />
    );
  }
  return (
    <View style={iconBox}>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>
        {name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const rowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 12,
  padding: 12,
  marginBottom: 8,
  borderRadius: 12,
  backgroundColor: colors.surface,
};

const iconBox = {
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: colors.surfaceHigh,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const titleStyle = { color: colors.text, fontWeight: '700' as const, fontSize: 15 };
const subStyle = { color: colors.textMuted, fontSize: 12, marginTop: 2 };
