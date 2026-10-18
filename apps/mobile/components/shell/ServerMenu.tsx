import { Modal, Pressable, Text, View } from 'react-native';
import { colors } from '@dracord/app-theme';
import { Icon } from '../Icon';

export function ServerMenu({
  open,
  serverName,
  onClose,
  onFavorite,
  favorite,
  onInvite,
  onEvents,
  onBoost,
  onSettings,
  onCreateChannel,
  onCreateCategory,
  onLeave,
}: {
  open: boolean;
  serverName: string;
  onClose: () => void;
  onFavorite?: () => void;
  favorite?: boolean;
  onInvite?: () => void;
  onEvents?: () => void;
  onBoost?: () => void;
  onSettings?: () => void;
  onCreateChannel?: () => void;
  onCreateCategory?: () => void;
  onLeave?: () => void;
}) {
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
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
            padding: 12,
            gap: 4,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontWeight: '800',
              fontSize: 16,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            {serverName}
          </Text>
          {onFavorite ? (
            <MenuItem
              icon="star"
              label={favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
              onPress={onFavorite}
            />
          ) : null}
          {onInvite ? (
            <MenuItem icon="person_add" label="Davet oluştur" onPress={onInvite} />
          ) : null}
          {onEvents ? (
            <MenuItem icon="event" label="Etkinlikler" onPress={onEvents} />
          ) : null}
          {onBoost ? (
            <MenuItem icon="rocket_launch" label="Sunucu takviyesi" onPress={onBoost} />
          ) : null}
          {onCreateChannel ? (
            <MenuItem icon="tag" label="Kanal oluştur" onPress={onCreateChannel} />
          ) : null}
          {onCreateCategory ? (
            <MenuItem
              icon="create_new_folder"
              label="Kategori oluştur"
              onPress={onCreateCategory}
            />
          ) : null}
          {onSettings ? (
            <MenuItem icon="settings" label="Sunucu ayarları" onPress={onSettings} />
          ) : null}
          {onLeave ? (
            <MenuItem icon="logout" label="Sunucudan ayrıl" onPress={onLeave} danger />
          ) : null}
          <MenuItem icon="close" label="Kapat" onPress={onClose} muted />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
  muted,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
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
        marginBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Icon name={icon} size={20} color={color} />
      <Text style={{ color, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
