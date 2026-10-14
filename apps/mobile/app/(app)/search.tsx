import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { SearchHit } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { inputStyle, primaryBtn, primaryBtnText } from '../../lib/ui';
import { rememberChannel } from '../../lib/lastChannel';

export default function SearchScreen() {
  const { client } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = () => {
    if (!q.trim()) return;
    setBusy(true);
    setSearched(true);
    void client
      .search({ q: q.trim(), limit: 30 })
      .then((r) => setHits(r.hits ?? []))
      .finally(() => setBusy(false));
  };

  const openChannel = async (guildId: string, channelId: string) => {
    await rememberChannel(guildId, channelId);
    router.push(`/(app)/channels/${guildId}/${channelId}`);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Stack.Screen options={{ title: 'Arama' }} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Kullanıcı, kanal, sunucu, mesaj…"
          placeholderTextColor={colors.textMuted}
          style={{ ...inputStyle, flex: 1 }}
          returnKeyType="search"
          onSubmitEditing={runSearch}
          autoFocus
        />
        <Pressable style={primaryBtn} onPress={runSearch}>
          {busy ? (
            <ActivityIndicator color={colors.primaryOn} />
          ) : (
            <Text style={primaryBtnText}>Ara</Text>
          )}
        </Pressable>
      </View>
      {busy ? <Text style={{ color: colors.textMuted }}>Aranıyor…</Text> : null}
      <FlatList
        data={hits}
        keyExtractor={(h) => `${h.type}-${h.id}`}
        renderItem={({ item: hit }) => <HitRow hit={hit} onOpenChannel={openChannel} />}
        ListEmptyComponent={
          searched && !busy ? (
            <Text style={{ color: colors.textMuted }}>Sonuç yok</Text>
          ) : null
        }
      />
    </View>
  );
}

function HitRow({
  hit,
  onOpenChannel,
}: {
  hit: SearchHit;
  onOpenChannel: (guildId: string, channelId: string) => void;
}) {
  if (hit.type === 'user') {
    return (
      <Row title={hit.displayName} sub={`@${hit.username}`} />
    );
  }
  if (hit.type === 'guild') {
    return <Row title={hit.name} sub="Sunucu" />;
  }
  if (hit.type === 'channel') {
    return (
      <Pressable onPress={() => hit.guildId && onOpenChannel(hit.guildId, hit.id)}>
        <Row title={`#${hit.name}`} sub={hit.guildId ?? 'DM'} />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={() => {
        if (hit.guildId && hit.channelId) onOpenChannel(hit.guildId, hit.channelId);
      }}
    >
      <Row title={hit.snippet || hit.content} sub={hit.authorName} />
    </Pressable>
  );
}

function Row({ title, sub }: { title: string; sub: string }) {
  return (
    <View
      style={{
        padding: 12,
        marginBottom: 8,
        borderRadius: 10,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '600' }}>{title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{sub}</Text>
    </View>
  );
}
