import { memo, useCallback, useMemo } from 'react';
import { FlatList, Pressable, Text, View, type ListRenderItemInfo } from 'react-native';
import type { CategoryDto, ChannelSummary, VoiceMemberSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useElapsedLabel } from '../../lib/formatElapsed';
import { useThemeRevision } from '../../lib/theme-revision';
import { Icon } from '../Icon';
import { UserAvatar } from '../UserAvatar';

function channelIconName(c: ChannelSummary) {
  if (c.type === 'VOICE') return 'volume_up';
  if (c.type === 'GAME' || c.type === 'WATCH_PARTY') return 'sports_esports';
  if (c.type === 'FORUM') return 'forum';
  return 'tag';
}

type Row =
  | { type: 'cat'; id: string; label: string; sort: number }
  | { type: 'ch'; ch: ChannelSummary; sort: number };

/** Web `buildSidebarCategories` ile aynı sıra: kategorisiz → kategoriler → oyunlar → watch */
function buildRows(channels: ChannelSummary[], guildCategories: CategoryDto[]): Row[] {
  const catMeta = new Map(guildCategories.map((c) => [c.id, c] as const));
  // CATEGORY tipi kanallar da meta olarak kullanılabilir
  for (const c of channels) {
    if (c.type === 'CATEGORY' && !catMeta.has(c.id)) {
      catMeta.set(c.id, { id: c.id, guildId: c.guildId ?? '', name: c.name, position: c.position });
    }
  }

  const gameChannels = channels
    .filter((c) => c.type === 'GAME')
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'tr'));
  const watchChannels = channels
    .filter((c) => c.type === 'WATCH_PARTY')
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'tr'));

  const textAndVoice = channels.filter(
    (c) => c.type !== 'CATEGORY' && c.type !== 'GAME' && c.type !== 'WATCH_PARTY',
  );

  const byCategory = new Map<string | null, ChannelSummary[]>();
  for (const ch of textAndVoice) {
    const key = ch.categoryId && catMeta.has(ch.categoryId) ? ch.categoryId : null;
    const list = byCategory.get(key) ?? [];
    list.push(ch);
    byCategory.set(key, list);
  }
  for (const cat of catMeta.values()) {
    if (!byCategory.has(cat.id)) byCategory.set(cat.id, []);
  }

  type Section = { id: string; label: string; sort: number; channels: ChannelSummary[] };
  const sections: Section[] = [];

  for (const [categoryId, list] of byCategory) {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'tr'));
    const meta = categoryId ? catMeta.get(categoryId) : undefined;
    sections.push({
      id: categoryId ?? 'uncategorized',
      label: meta?.name ?? (categoryId ? 'Kategori' : 'Kanallar'),
      sort: meta?.position ?? (categoryId ? 999 : -1),
      channels: list,
    });
  }

  sections.sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort;
    return a.label.localeCompare(b.label, 'tr');
  });

  if (gameChannels.length) {
    sections.push({ id: '__games__', label: 'Oyunlar', sort: 10_000, channels: gameChannels });
  }
  if (watchChannels.length) {
    sections.push({
      id: '__watch__',
      label: 'Watch Party',
      sort: 10_001,
      channels: watchChannels,
    });
  }

  const rows: Row[] = [];
  for (const sec of sections) {
    if (sec.id !== 'uncategorized' || sec.channels.length > 0) {
      if (sec.id !== 'uncategorized' || sections.length > 1) {
        rows.push({ type: 'cat', id: sec.id, label: sec.label, sort: sec.sort });
      }
    }
    for (const ch of sec.channels) {
      rows.push({ type: 'ch', ch, sort: sec.sort });
    }
  }

  // Güvenlik ağı
  const listed = new Set(rows.filter((r): r is Extract<Row, { type: 'ch' }> => r.type === 'ch').map((r) => r.ch.id));
  for (const ch of channels) {
    if (ch.type === 'CATEGORY') continue;
    if (!listed.has(ch.id)) rows.push({ type: 'ch', ch, sort: 9999 });
  }
  return rows;
}

export function ChannelList({
  channels,
  categories = [],
  activeChannelId,
  onOpenChannel,
  serverName,
  onOpenServerMenu,
  onOpenMembers,
  onVoiceMemberPress,
  onVoiceMemberLongPress,
  selfUserId,
  activeVoiceChannelId,
  activeActivityChannelId,
}: {
  channels: ChannelSummary[];
  categories?: CategoryDto[];
  activeChannelId?: string | null;
  onOpenChannel: (c: ChannelSummary) => void;
  serverName?: string;
  onOpenServerMenu?: () => void;
  onOpenMembers?: () => void;
  onVoiceMemberPress?: (member: VoiceMemberSummary, channel: ChannelSummary) => void;
  onVoiceMemberLongPress?: (member: VoiceMemberSummary, channel: ChannelSummary) => void;
  selfUserId?: string | null;
  activeVoiceChannelId?: string | null;
  activeActivityChannelId?: string | null;
}) {
  const listData = useMemo(() => buildRows(channels, categories), [channels, categories]);

  const renderItem = useCallback(
    ({ item: row }: ListRenderItemInfo<Row>) =>
      row.type === 'cat' ? (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '800',
            paddingHorizontal: 14,
            paddingTop: 14,
            paddingBottom: 4,
            letterSpacing: 0.4,
          }}
        >
          {row.label.toUpperCase()}
        </Text>
      ) : (
        <ChannelRow
          channel={row.ch}
          active={row.ch.id === activeChannelId}
          onPress={onOpenChannel}
          selfUserId={selfUserId}
          activeVoiceChannelId={activeVoiceChannelId}
          activeActivityChannelId={activeActivityChannelId}
          onVoiceMemberPress={onVoiceMemberPress}
          onVoiceMemberLongPress={onVoiceMemberLongPress}
        />
      ),
    [
      activeChannelId,
      activeVoiceChannelId,
      activeActivityChannelId,
      onOpenChannel,
      selfUserId,
      onVoiceMemberPress,
      onVoiceMemberLongPress,
    ],
  );

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.surface }}>
      {serverName ? (
        <Pressable
          onPress={onOpenServerMenu}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.surfaceHigh,
            gap: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', flex: 1, fontSize: 15 }} numberOfLines={1}>
            {serverName}
          </Text>
          {onOpenMembers ? (
            <Pressable onPress={onOpenMembers} hitSlop={8}>
              <Icon name="group" size={20} color={colors.primary} />
            </Pressable>
          ) : null}
          <Icon name="expand_more" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
      <FlatList
        style={{ flex: 1 }}
        data={listData}
        keyExtractor={(row) => (row.type === 'cat' ? `cat-${row.id}` : `ch-${row.ch.id}`)}
        renderItem={renderItem}
        initialNumToRender={16}
        maxToRenderPerBatch={8}
        windowSize={5}
        updateCellsBatchingPeriod={80}
        removeClippedSubviews
        extraData={`${activeChannelId ?? ''}:${activeVoiceChannelId ?? ''}:${activeActivityChannelId ?? ''}`}
        contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, padding: 16, textAlign: 'center' }}>
            Bu sunucuda kanal yok
          </Text>
        }
      />
    </View>
  );
}

const ChannelRow = memo(function ChannelRow({
  channel,
  active,
  onPress,
  selfUserId,
  activeVoiceChannelId,
  activeActivityChannelId,
  onVoiceMemberPress,
  onVoiceMemberLongPress,
}: {
  channel: ChannelSummary;
  active?: boolean;
  onPress: (c: ChannelSummary) => void;
  selfUserId?: string | null;
  /** Gerçekten bağlı olunan ses kanalı — başka sunucuda self hayaletini filtrele */
  activeVoiceChannelId?: string | null;
  activeActivityChannelId?: string | null;
  onVoiceMemberPress?: (member: VoiceMemberSummary, channel: ChannelSummary) => void;
  onVoiceMemberLongPress?: (member: VoiceMemberSummary, channel: ChannelSummary) => void;
}) {
  useThemeRevision();
  const unread = (channel.unreadCount ?? 0) > 0 || channel.unread;
  // Ses bağlıysa yalnızca o kanalda self göster (oyun sesi hayaleti kalmasın)
  const selfLiveHere = activeVoiceChannelId
    ? activeVoiceChannelId === channel.id
    : activeActivityChannelId === channel.id;
  const voiceMembers = (channel.voiceMembers ?? []).filter((m) => {
    if (!selfUserId || m.id !== selfUserId) return true;
    // Başka sunucuda gezerken / başka kanaldaysa kendini listede gösterme
    return selfLiveHere;
  });
  const selfJoined =
    selfUserId != null && selfLiveHere
      ? voiceMembers.find((m) => m.id === selfUserId)?.joinedAt
      : null;
  const selfElapsed = useElapsedLabel(selfJoined);

  return (
    <View>
      <Pressable
        onPress={() => onPress(channel)}
        style={{
          marginHorizontal: 8,
          marginVertical: 1,
          paddingHorizontal: 10,
          paddingVertical: 9,
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: active ? colors.surfaceHigh : 'transparent',
        }}
      >
        <View style={{ marginRight: 8 }}>
          <Icon
            name={channelIconName(channel)}
            size={18}
            color={unread || active ? colors.text : colors.textMuted}
          />
        </View>
        <Text
          style={{
            color: unread || active ? colors.text : colors.textMuted,
            flex: 1,
            fontWeight: unread || active ? '700' : '500',
          }}
          numberOfLines={1}
        >
          {channel.name}
        </Text>
        {selfElapsed ? (
          <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700', marginRight: 6 }}>
            {selfElapsed}
          </Text>
        ) : (channel.type === 'VOICE' ||
            channel.type === 'GAME' ||
            channel.type === 'WATCH_PARTY') &&
          voiceMembers.length > 0 ? (
          <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700', marginRight: 6 }}>
            {voiceMembers.length}
          </Text>
        ) : null}
        {unread ? (
          <View
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 5,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
              {channel.unreadCount && channel.unreadCount > 0
                ? channel.unreadCount > 99
                  ? '99+'
                  : channel.unreadCount
                : ''}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {(channel.type === 'VOICE' ||
        channel.type === 'GAME' ||
        channel.type === 'WATCH_PARTY') &&
      voiceMembers.length > 0
        ? voiceMembers.map((m) => (
            <VoiceMemberRow
              key={m.id}
              member={m}
              channel={channel}
              onPress={onVoiceMemberPress}
              onLongPress={onVoiceMemberLongPress}
            />
          ))
        : null}
    </View>
  );
});

const VoiceMemberRow = memo(function VoiceMemberRow({
  member,
  channel,
  onPress,
  onLongPress,
}: {
  member: VoiceMemberSummary;
  channel: ChannelSummary;
  onPress?: (member: VoiceMemberSummary, channel: ChannelSummary) => void;
  onLongPress?: (member: VoiceMemberSummary, channel: ChannelSummary) => void;
}) {
  useThemeRevision();
  const elapsed = useElapsedLabel(member.joinedAt);
  return (
    <Pressable
      onPress={onPress ? () => onPress(member, channel) : undefined}
      onLongPress={onLongPress ? () => onLongPress(member, channel) : undefined}
      delayLongPress={280}
      style={{
        marginLeft: 36,
        marginRight: 12,
        marginBottom: 2,
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: member.speaking ? 'rgba(189,147,249,0.15)' : 'transparent',
      }}
    >
      <UserAvatar
        displayName={member.displayName}
        imageUrl={member.avatarUrl}
        size={28}
        speaking={member.speaking}
        statusRing={false}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: member.speaking ? colors.text : colors.textMuted,
            fontSize: 13,
            fontWeight: member.speaking ? '700' : '500',
          }}
          numberOfLines={1}
        >
          {member.displayName}
        </Text>
        {elapsed ? (
          <Text style={{ color: colors.textMuted, fontSize: 10 }}>{elapsed}</Text>
        ) : null}
      </View>
      {member.isBot ? (
        <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '800' }}>BOT</Text>
      ) : null}
      {member.screenSharing ? (
        <Icon name="present_to_all" size={14} color={colors.primary} />
      ) : null}
      {member.speaking ? <Icon name="graphic_eq" size={14} color={colors.primary} /> : null}
      {member.muted ? <Icon name="mic_off" size={14} color={colors.danger} /> : null}
      {member.deafened ? <Icon name="headset_off" size={14} color={colors.danger} /> : null}
    </Pressable>
  );
});
