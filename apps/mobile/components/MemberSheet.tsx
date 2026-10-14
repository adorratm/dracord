import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import type { PublicUser } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { statusColor } from '../lib/ui';

export function MemberSheet({
  open,
  onClose,
  members,
  title,
}: {
  open: boolean;
  onClose: () => void;
  members: PublicUser[];
  title?: string;
}) {
  const online = members.filter((m) => m.status && m.status !== 'OFFLINE');
  const offline = members.filter((m) => !m.status || m.status === 'OFFLINE');
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
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.surfaceHigh,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {title ?? `Üyeler (${members.length})`}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.textMuted }}>Kapat</Text>
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
                  <MemberRow key={m.id} user={m} />
                ))}
              </View>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MemberRow({ user }: { user: PublicUser }) {
  const st = user.status ?? 'OFFLINE';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
      <View style={{ position: 'relative' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.surfaceHigh,
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: statusColor[st] ?? colors.offline,
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{user.displayName}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>@{user.username}</Text>
        {user.customStatus ? (
          <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
            {user.customStatus}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
