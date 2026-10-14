import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';
import type { ChannelSummary, GuildSummary, PublicUser } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { GAME_KIND_LABEL } from '@dracord/game-core';
import { useAuth } from '../../lib/auth';
import { rememberChannel, readGuildLastChannel, readLastChannel } from '../../lib/lastChannel';
import { CreateGuildModal, JoinInviteModal } from '../../components/GuildModals';
import { MemberSheet } from '../../components/MemberSheet';

function channelIcon(c: ChannelSummary) {
  if (c.type === 'VOICE') return '🔊 ';
  if (c.type === 'GAME' || c.type === 'WATCH_PARTY') return '🎮 ';
  return '# ';
}

export default function GuildsScreen() {
  const { client, user } = useAuth();
  const router = useRouter();
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const reloadGuilds = () =>
    client.listGuilds().then((g) => {
      setGuilds(g);
      return g;
    });

  useEffect(() => {
    void (async () => {
      const g = await reloadGuilds();
      if (!g.length) return;
      const last = await readLastChannel();
      if (last && g.some((x) => x.id === last.guildId)) {
        setGuildId(last.guildId);
        return;
      }
      setGuildId(g[0]!.id);
    })();
  }, [client]);

  useEffect(() => {
    if (!guildId) return;
    void client.getGuildChannels(guildId).then(setChannels);
    void client.getGuildMembers(guildId).then(setMembers).catch(() => setMembers([]));
  }, [client, guildId]);

  const channelTree = useMemo(() => {
    const cats = channels
      .filter((c) => c.type === 'CATEGORY')
      .sort((a, b) => a.position - b.position);
    const rest = channels
      .filter((c) => c.type !== 'CATEGORY')
      .sort((a, b) => a.position - b.position);
    const byParent = new Map<string | null, ChannelSummary[]>();
    for (const c of rest) {
      const key = c.categoryId ?? null;
      const arr = byParent.get(key) ?? [];
      arr.push(c);
      byParent.set(key, arr);
    }
    return { cats, byParent, uncategorized: byParent.get(null) ?? [] };
  }, [channels]);

  const openChannel = async (c: ChannelSummary) => {
    if (!guildId) return;
    await rememberChannel(guildId, c.id);
    if (c.type === 'VOICE') {
      router.push(`/(app)/voice/${guildId}/${c.id}`);
    } else if (c.type === 'GAME' || c.type === 'WATCH_PARTY') {
      router.push(`/(app)/activity/${guildId}/${c.id}`);
    } else {
      router.push(`/(app)/channels/${guildId}/${c.id}`);
    }
  };

  const pickGuild = async (id: string) => {
    setGuildId(id);
    const preferId = await readGuildLastChannel(id);
    const chs = await client.getGuildChannels(id);
    setChannels(chs);
    const prefer = preferId ? chs.find((c) => c.id === preferId) : undefined;
    const first = prefer ?? chs.find((c) => c.type === 'TEXT') ?? chs.find((c) => c.type !== 'CATEGORY');
    if (first && first.type !== 'CATEGORY') void openChannel(first);
  };

  const leaveGuild = () => {
    if (!guildId) return;
    Alert.alert('Sunucudan ayrıl', 'Bu sunucudan ayrılmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Ayrıl',
        style: 'destructive',
        onPress: () => {
          void client.leaveGuild(guildId).then(async () => {
            const g = await reloadGuilds();
            setGuildId(g[0]?.id ?? null);
          });
        },
      },
    ]);
  };

  const renderChannel = (c: ChannelSummary) => {
    const unread = (c.unreadCount ?? 0) > 0 || c.unread;
    return (
      <Pressable
        key={c.id}
        onPress={() => void openChannel(c)}
        style={{ paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}
      >
        <Text style={{ color: unread ? colors.text : colors.textMuted, flex: 1 }}>
          {channelIcon(c)}
          {c.name}
          {c.gameKind ? ` · ${GAME_KIND_LABEL[c.gameKind]}` : ''}
        </Text>
        {unread ? (
          <View
            style={{
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
              {c.unreadCount && c.unreadCount > 0 ? (c.unreadCount > 99 ? '99+' : c.unreadCount) : '•'}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const listData = useMemo(() => {
    const rows: Array<{ type: 'cat' | 'ch'; cat?: ChannelSummary; ch?: ChannelSummary }> = [];
    for (const ch of channelTree.uncategorized) rows.push({ type: 'ch', ch });
    for (const cat of channelTree.cats) {
      rows.push({ type: 'cat', cat });
      const kids = channelTree.byParent.get(cat.id) ?? [];
      for (const ch of kids) rows.push({ type: 'ch', ch });
    }
    return rows;
  }, [channelTree]);

  const headerLinks = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, maxWidth: 220, justifyContent: 'flex-end' }}>
      <Link href="/(app)/friends" asChild>
        <Pressable><Text style={{ color: colors.primary, fontSize: 13 }}>Arkadaş</Text></Pressable>
      </Link>
      <Link href="/(app)/notifications" asChild>
        <Pressable><Text style={{ color: colors.primary, fontSize: 13 }}>Bildirim</Text></Pressable>
      </Link>
      <Link href="/(app)/search" asChild>
        <Pressable><Text style={{ color: colors.primary, fontSize: 13 }}>Ara</Text></Pressable>
      </Link>
      <Link href="/(app)/dms" asChild>
        <Pressable><Text style={{ color: colors.primary, fontSize: 13 }}>DM</Text></Pressable>
      </Link>
      <Link href="/(app)/discover" asChild>
        <Pressable><Text style={{ color: colors.textMuted, fontSize: 13 }}>Keşfet</Text></Pressable>
      </Link>
      <Link href="/(app)/settings" asChild>
        <Pressable><Text style={{ color: colors.textMuted, fontSize: 13 }}>Ayarlar</Text></Pressable>
      </Link>
    </View>
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <Stack.Screen options={{ title: 'Dracord', headerRight: () => headerLinks }} />
      <View style={{ width: 64, backgroundColor: '#0c0d14', paddingVertical: 8 }}>
        <Pressable
          onPress={() => setCreateOpen(true)}
          style={{
            marginHorizontal: 8,
            marginBottom: 8,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.success,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>+</Text>
        </Pressable>
        {guilds.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => void pickGuild(g.id)}
            style={{
              marginHorizontal: 8,
              marginBottom: 8,
              height: 48,
              borderRadius: guildId === g.id ? 14 : 24,
              backgroundColor: guildId === g.id ? colors.primary : colors.surfaceHigh,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: guildId === g.id ? colors.primaryOn : colors.text,
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              {g.name.slice(0, 2).toUpperCase()}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setJoinOpen(true)}
          style={{
            marginHorizontal: 8,
            height: 48,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: colors.surfaceHigh,
            borderStyle: 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 18 }}>⤵</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12 }}>
          <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
            {guilds.find((g) => g.id === guildId)?.name ?? 'Sunucu'}
          </Text>
          {guildId ? (
            <>
              <Pressable onPress={() => setMembersOpen(true)} style={{ padding: 8 }}>
                <Text style={{ color: colors.primary }}>👥</Text>
              </Pressable>
              <Link href={`/(app)/guild-settings/${guildId}`} asChild>
                <Pressable style={{ padding: 8 }}>
                  <Text style={{ color: colors.textMuted }}>⚙</Text>
                </Pressable>
              </Link>
            </>
          ) : null}
        </View>
        <Text style={{ color: colors.textMuted, paddingHorizontal: 12, marginBottom: 8 }}>{user?.displayName}</Text>
        <FlatList
          data={listData}
          keyExtractor={(row) => (row.type === 'cat' ? `cat-${row.cat!.id}` : `ch-${row.ch!.id}`)}
          renderItem={({ item: row }) =>
            row.type === 'cat' ? (
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 11,
                  fontWeight: '700',
                  paddingHorizontal: 12,
                  paddingTop: 14,
                  paddingBottom: 4,
                }}
              >
                {row.cat!.name.toUpperCase()}
              </Text>
            ) : (
              renderChannel(row.ch!)
            )
          }
        />
        {guildId ? (
          <View style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
            <Pressable onPress={leaveGuild}>
              <Text style={{ color: colors.danger }}>Sunucudan ayrıl</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <CreateGuildModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => void pickGuild(id)}
      />
      <JoinInviteModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={(id) => void pickGuild(id)}
      />
      <MemberSheet open={membersOpen} onClose={() => setMembersOpen(false)} members={members} />
    </View>
  );
}
