import {
  ActionSheetIOS,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { PublicUser } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { UserAvatar } from '../UserAvatar';
import { useElapsedLabel } from '../../lib/formatElapsed';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { normalizePresence, presenceLabelTr } from '../../lib/presence';

export type ProfileAction = {
  id: string;
  label: string;
  danger?: boolean;
  onSelect: () => void;
};

export function ProfileSheet({
  user,
  onClose,
  actions = [],
  joinedAt,
}: {
  user: PublicUser | null;
  onClose: () => void;
  /** Web sol tık profil + sağ tık menü aksiyonları */
  actions?: ProfileAction[];
  /** Ses kanalına katılım zamanı — süre sayacı */
  joinedAt?: string | null;
}) {
  const elapsed = useElapsedLabel(joinedAt);
  if (!user) return null;
  const st = normalizePresence(user.status);
  const primary = actions.filter((a) => !a.danger);
  const danger = actions.filter((a) => a.danger);

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
            {primary.map((a) => (
              <ActionRow key={a.id} label={a.label} onPress={() => { a.onSelect(); onClose(); }} />
            ))}
            {danger.map((a) => (
              <ActionRow
                key={a.id}
                label={a.label}
                danger
                onPress={() => {
                  a.onSelect();
                  onClose();
                }}
              />
            ))}
            <ActionRow label="Kapat" muted onPress={onClose} />
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
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: colors.surfaceHigh,
      }}
    >
      <Text
        style={{
          color: danger ? colors.danger : muted ? colors.textMuted : colors.text,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Uzun basma / sağ tık benzeri aksiyon listesi */
export function presentMemberActions(
  title: string,
  actions: ProfileAction[],
  onCancel?: () => void,
) {
  if (Platform.OS === 'ios') {
    const labels = [...actions.map((a) => a.label), 'İptal'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: actions
          .map((a, i) => (a.danger ? i : -1))
          .filter((i) => i >= 0)[0],
      },
      (idx) => {
        if (idx === undefined || idx >= actions.length) {
          onCancel?.();
          return;
        }
        actions[idx]?.onSelect();
      },
    );
    return;
  }
  Alert.alert(
    title,
    undefined,
    [
      ...actions.map((a) => ({
        text: a.label,
        style: a.danger ? ('destructive' as const) : ('default' as const),
        onPress: a.onSelect,
      })),
      { text: 'İptal', style: 'cancel' as const, onPress: onCancel },
    ],
    { cancelable: true },
  );
}

export async function copyUserId(id: string) {
  try {
    await Clipboard.setStringAsync(id);
    Alert.alert('Kopyalandı', 'Kullanıcı ID panoya alındı');
  } catch {
    Alert.alert('ID', id);
  }
}
