import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { colors } from '@dracord/app-theme';
import { Icon } from './Icon';

export type ActionSheetItem = {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  muted?: boolean;
  onSelect: () => void;
};

/** Uygulama stili alt menü — Android Alert / iOS ActionSheet yerine */
export function ActionsSheet({
  open,
  title,
  subtitle,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  actions: ActionSheetItem[];
  onClose: () => void;
}) {
  if (!open) return null;

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
            maxHeight: '78%',
            paddingBottom: 16,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.surfaceHigh,
              marginTop: 10,
              marginBottom: 8,
            }}
          />
          <Text
            style={{
              color: colors.text,
              fontWeight: '800',
              fontSize: 16,
              paddingHorizontal: 16,
              marginBottom: subtitle ? 2 : 10,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                paddingHorizontal: 16,
                marginBottom: 10,
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}

          <ScrollView
            style={{ maxHeight: 480 }}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 4, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {actions.map((a) => (
              <SheetRow
                key={a.id}
                icon={a.icon ?? (a.danger ? 'warning' : 'chevron_right')}
                label={a.label}
                danger={a.danger}
                muted={a.muted}
                onPress={() => {
                  a.onSelect();
                  onClose();
                }}
              />
            ))}
            <SheetRow icon="close" label="İptal" muted onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetRow({
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
        paddingVertical: 13,
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
      <Text style={{ color, fontWeight: '700', flex: 1, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
