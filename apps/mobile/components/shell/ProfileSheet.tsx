import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { PublicUser, UserActivity } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { noticeDialog } from '../ConfirmModal';
import { Icon } from '../Icon';
import { UserAvatar } from '../UserAvatar';
import { useElapsedLabel } from '../../lib/formatElapsed';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { normalizePresence, presenceLabelTr } from '../../lib/presence';

function activityLabel(a: UserActivity): string {
  const prefix =
    a.type === 'listening'
      ? 'Dinliyor'
      : a.type === 'watching'
        ? 'İzliyor'
        : a.type === 'custom'
          ? ''
          : 'Oynuyor';
  return prefix ? `${prefix} · ${a.name}` : a.name;
}

export type ProfileAction = {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  onSelect: () => void;
};

export function ProfileSheet({
  user,
  onClose,
  actions = [],
  joinedAt,
  onJoinActivity,
}: {
  user: PublicUser | null;
  onClose: () => void;
  /** Web sol tık profil + sağ tık menü aksiyonları */
  actions?: ProfileAction[];
  /** Ses kanalına katılım zamanı — süre sayacı */
  joinedAt?: string | null;
  onJoinActivity?: (activity: UserActivity) => void;
}) {
  const elapsed = useElapsedLabel(joinedAt);
  if (!user) return null;
  const st = normalizePresence(user.status);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '85%',
            paddingBottom: 20,
          }}
        >
          <View
            style={{
              height: 96,
              backgroundColor: user.bannerColor || user.accentColor || colors.surfaceHigh,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              overflow: 'hidden',
            }}
          >
            {resolveMediaUrl(user.bannerUrl) ? (
              <Image
                source={{ uri: resolveMediaUrl(user.bannerUrl)! }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : null}
          </View>
          <View style={{ paddingHorizontal: 20, marginTop: -28 }}>
            <UserAvatar
              displayName={user.displayName}
              imageUrl={user.avatarUrl}
              size={72}
              status={st}
            />
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 22, marginTop: 10 }}>
              {user.displayName}
            </Text>
            <Text style={{ color: colors.textMuted }}>@{user.username}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              {presenceLabelTr(st, user.customStatus)}
            </Text>
            {user.activity ? (
              <View
                style={{
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: colors.surfaceHigh,
                  borderRadius: 10,
                  padding: 8,
                }}
              >
                <Icon
                  name={
                    user.activity.type === 'listening'
                      ? 'headphones'
                      : user.activity.type === 'watching'
                        ? 'live_tv'
                        : 'sports_esports'
                  }
                  size={20}
                  color={colors.success}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.success, fontWeight: '700', fontSize: 13 }}>
                    {activityLabel(user.activity)}
                  </Text>
                  {user.activity.details ? (
                    <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                      {user.activity.details}
                    </Text>
                  ) : null}
                  {user.activity.join && onJoinActivity ? (
                    <Pressable
                      onPress={() => onJoinActivity(user.activity!)}
                      style={{ marginTop: 4 }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
                        Katıl
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
            {elapsed ? (
              <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: '700' }}>
                Seste · {elapsed}
              </Text>
            ) : null}
            {user.bio ? (
              <Text style={{ color: colors.text, lineHeight: 20, marginTop: 10 }}>{user.bio}</Text>
            ) : null}
            {user.roles && user.roles.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {user.roles.map((r) => (
                  <View
                    key={r.id}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: colors.surfaceHigh,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>{r.name}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <ScrollView style={{ marginTop: 16, maxHeight: 280 }} contentContainerStyle={{ paddingHorizontal: 12, gap: 4 }}>
            {actions.map((a) => (
              <ActionRow
                key={a.id}
                icon={a.icon}
                label={a.label}
                danger={a.danger}
                onPress={() => {
                  onClose();
                  const run = a.onSelect;
                  setTimeout(() => run(), 120);
                }}
              />
            ))}
            <ActionRow icon="close" label="Kapat" muted onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  label,
  onPress,
  danger,
  muted,
  icon,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
  icon?: string;
}) {
  const color = danger ? colors.danger : muted ? colors.textMuted : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: colors.surfaceHigh,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {icon ? <Icon name={icon} size={20} color={color} /> : null}
      <Text style={{ color, fontWeight: '700', flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

export async function copyUserId(id: string) {
  try {
    await Clipboard.setStringAsync(id);
    await noticeDialog('Kopyalandı', 'Kullanıcı ID panoya alındı');
  } catch {
    await noticeDialog('ID', id);
  }
}
