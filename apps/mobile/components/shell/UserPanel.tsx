import { useState } from 'react';
import { Image, Modal, Pressable, Text, TextInput, View } from 'react-native';
import type { PresenceStatus, PublicUser } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { activityLineTr, presenceLabelTr } from '../../lib/presence';
import { Icon } from '../Icon';
import { UserAvatar } from '../UserAvatar';

/** Seçicide OFFLINE = görünmez; listelerde Çevrimdışı */
const STATUSES: Array<{ id: PresenceStatus; label: string }> = [
  { id: 'ONLINE', label: 'Çevrimiçi' },
  { id: 'IDLE', label: 'Boşta' },
  { id: 'DND', label: 'Rahatsız etme' },
  { id: 'OFFLINE', label: 'Görünmez' },
];

/** Web ChannelSidebar UserPanel — durum + ayarlar */
export function UserPanel({
  user,
  onStatusChange,
  onOpenSettings,
  onOpenProfile,
}: {
  user: PublicUser | null;
  onStatusChange?: (status: PresenceStatus, customStatus?: string | null) => void;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(user?.customStatus ?? '');
  const status = user?.status ?? 'ONLINE';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        onLongPress={onOpenProfile}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceHigh,
          backgroundColor: colors.rail,
        }}
      >
        <UserAvatar
          displayName={user?.displayName ?? '?'}
          imageUrl={user?.avatarUrl}
          size={36}
          status={status}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
            {user?.displayName ?? 'Kullanıcı'}
          </Text>
          {(() => {
            const act = activityLineTr(user?.activity);
            if (act) {
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  {user?.activity?.imageUrl ? (
                    <Image
                      source={{ uri: user.activity.imageUrl }}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        backgroundColor: colors.surfaceHigh,
                      }}
                    />
                  ) : null}
                  <Text style={{ color: colors.success, fontSize: 11, flexShrink: 1 }} numberOfLines={1}>
                    {act}
                  </Text>
                </View>
              );
            }
            return (
              <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                {presenceLabelTr(status, user?.customStatus) || `@${user?.username ?? ''}`}
              </Text>
            );
          })()}
        </View>
        <Pressable onPress={onOpenSettings} hitSlop={8} style={{ padding: 6 }}>
          <Icon name="settings" size={20} color={colors.textMuted} />
        </Pressable>
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <UserAvatar
                displayName={user?.displayName ?? '?'}
                imageUrl={user?.avatarUrl}
                size={48}
                status={status}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
                  {user?.displayName}
                </Text>
                <Text style={{ color: colors.textMuted }}>@{user?.username}</Text>
              </View>
            </View>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 4 }}>
              Durum
            </Text>
            {STATUSES.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  onStatusChange?.(s.id, custom.trim() || null);
                  setOpen(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 10,
                  backgroundColor: status === s.id ? colors.surfaceHigh : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor:
                      s.id === 'ONLINE'
                        ? colors.online
                        : s.id === 'IDLE'
                          ? colors.idle
                          : s.id === 'DND'
                            ? colors.dnd
                            : colors.offline,
                  }}
                />
                <Text style={{ color: colors.text, fontWeight: '600' }}>{s.label}</Text>
              </Pressable>
            ))}
            <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 12 }}>Özel durum</Text>
            <TextInput
              value={custom}
              onChangeText={setCustom}
              placeholder="Ne yapıyorsun?"
              placeholderTextColor={colors.textMuted}
              style={{
                height: 44,
                borderRadius: 10,
                paddingHorizontal: 12,
                backgroundColor: colors.surfaceHigh,
                color: colors.text,
              }}
              onSubmitEditing={() => {
                onStatusChange?.(status, custom.trim() || null);
                setOpen(false);
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={() => {
                  onOpenProfile?.();
                  setOpen(false);
                }}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceHigh,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>Profil</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onOpenSettings?.();
                  setOpen(false);
                }}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.primaryOn, fontWeight: '700' }}>Ayarlar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
