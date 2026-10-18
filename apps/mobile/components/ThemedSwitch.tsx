import { Pressable, View } from 'react-native';
import { colors } from '@dracord/app-theme';
import { useThemeRevision } from '../lib/theme-revision';

/** Android varsayılan Switch yerine Dracord temalı anahtar */
export function ThemedSwitch({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  useThemeRevision();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        padding: 3,
        justifyContent: 'center',
        backgroundColor: value ? colors.primary : colors.surfaceHigh,
        borderWidth: 1,
        borderColor: value ? colors.primary : colors.outline,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: value ? colors.primaryOn : colors.textMuted,
          alignSelf: value ? 'flex-end' : 'flex-start',
        }}
      />
    </Pressable>
  );
}
