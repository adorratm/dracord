import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import type { PublicUser } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { isOnlinePresence, normalizePresence, presenceLabelTr } from '../lib/presence';
import { UserAvatar } from './UserAvatar';
import { Icon } from './Icon';

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
  const online = members.filter((m) => isOnlinePresence(m.status));
  const offline = members.filter((m) => !isOnlinePresence(m.status));
  const sections = [
    { key: 'on', label: `Çevrimiçi — ${online.length}`, data: online },
    { key: 'off', label: `Çevrimdışı — ${offline.length}`, data: offline },
  ].filter((s) => s.data.length > 0);

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
            data={sections}
            keyExtractor={(s) => s.key}
            renderItem={({ item: section }) => (
              <View>
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
                  {section.label}
                </Text>
                {section.data.map((m) => (
                  <MemberRow
                    key={m.id}
                    user={m}
                    onPress={onSelectMember ? () => onSelectMember(m) : undefined}
                    onLongPress={onMemberLongPress ? () => onMemberLongPress(m) : undefined}
                  />
                ))}
              </View>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MemberRow({
  user,
  onPress,
  onLongPress,
}: {
  user: PublicUser;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
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
}
