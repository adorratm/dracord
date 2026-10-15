import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@dracord/app-theme';
import { Icon } from '../Icon';

/** Web TitleBar (mobil): hamburger + başlık + ara + bildirim */
export function TitleBar({
  title = 'Dracord',
  subtitle,
  onMenu,
  onChannels,
  onMembers,
  onSearch,
  onNotifications,
  notificationCount = 0,
}: {
  title?: string;
  subtitle?: string | null;
  onMenu?: () => void;
  onChannels?: () => void;
  onMembers?: () => void;
  onSearch?: () => void;
  onNotifications?: () => void;
  notificationCount?: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceHigh,
      }}
    >
      <View
        style={{
          height: 48,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          gap: 2,
        }}
      >
        {onMenu ? (
          <IconBtn name="menu" onPress={onMenu} accessibilityLabel="Sunucular" />
        ) : null}
        {onChannels ? (
          <IconBtn name="list" onPress={onChannels} accessibilityLabel="Kanallar" />
        ) : null}
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 6 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onMembers ? (
          <IconBtn name="group" onPress={onMembers} accessibilityLabel="Üyeler" />
        ) : null}
        {onSearch ? (
          <IconBtn name="search" onPress={onSearch} accessibilityLabel="Ara" />
        ) : null}
        {onNotifications ? (
          <View>
            <IconBtn name="notifications" onPress={onNotifications} accessibilityLabel="Bildirimler" />
            {notificationCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: colors.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 3,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function IconBtn({
  name,
  onPress,
  accessibilityLabel,
}: {
  name: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={22} color={colors.text} />
    </Pressable>
  );
}
