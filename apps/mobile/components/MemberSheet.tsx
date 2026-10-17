import { memo, useCallback, useMemo } from 'react';
import { FlatList, Modal, Pressable, Text, View, type ListRenderItemInfo } from 'react-native';
import type { PublicUser } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { isOnlinePresence, normalizePresence, presenceLabelTr } from '../lib/presence';
import { UserAvatar } from './UserAvatar';
import { Icon } from './Icon';
import { useThemeRevision } from '../lib/theme-revision';

type Row =
  | { type: 'header'; key: string; label: string }
  | { type: 'member'; key: string; user: PublicUser };

export function MemberSheet({
  open,
  onClose,
  members,
  title,
  onSelectMember,
  onMemberLongPress,
}: {
  open: boolean;
  onClose: () => void;
  members: PublicUser[];
  title?: string;
  onSelectMember?: (user: PublicUser) => void;
  onMemberLongPress?: (user: PublicUser) => void;
}) {
  const rows = useMemo<Row[]>(() => {
    const online = members.filter((m) => isOnlinePresence(m.status));
    const offline = members.filter((m) => !isOnlinePresence(m.status));
    const out: Row[] = [];
    if (online.length) {
      out.push({ type: 'header', key: 'on', label: `Çevrimiçi — ${online.length}` });
      for (const m of online) out.push({ type: 'member', key: m.id, user: m });
    }
    if (offline.length) {
      out.push({ type: 'header', key: 'off', label: `Çevrimdışı — ${offline.length}` });
      for (const m of offline) out.push({ type: 'member', key: m.id, user: m });
    }
    return out;
  }, [members]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      if (item.type === 'header') {
        return (
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: '700',
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 4,
            }}
          >
            {item.label}
          </Text>
        );
      }
      return (
        <MemberRow
          user={item.user}
          onPress={onSelectMember ? () => onSelectMember(item.user) : undefined}
          onLongPress={onMemberLongPress ? () => onMemberLongPress(item.user) : undefined}
        />
      );
    },
    [onSelectMember, onMemberLongPress],
  );

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '75%',
            paddingBottom: 24,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.surfaceHigh,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {title ?? `Üyeler (${members.length})`}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Kapat">
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={renderItem}
            initialNumToRender={18}
            maxToRenderPerBatch={12}
            windowSize={7}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const MemberRow = memo(function MemberRow({
  user,
  onPress,
  onLongPress,
}: {
  user: PublicUser;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  useThemeRevision();
  const st = normalizePresence(user.status);
  const offline = st === 'OFFLINE';
  const subtitle = presenceLabelTr(st, user.customStatus);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      disabled={!onPress && !onLongPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
        opacity: offline ? 0.72 : 1,
      }}
    >
      <UserAvatar displayName={user.displayName} imageUrl={user.avatarUrl} size={36} status={st} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
          {user.displayName}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {user.isBot ? (
        <Text
          style={{
            color: colors.primaryOn,
            backgroundColor: colors.primary,
            fontSize: 9,
            fontWeight: '800',
            paddingHorizontal: 5,
            paddingVertical: 2,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          BOT
        </Text>
      ) : null}
    </Pressable>
  );
});
