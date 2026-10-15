import { Text, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '@dracord/app-theme';

/** Web `material-symbols-outlined` ile aynı ligature isimleri */
const FONT = 'MaterialSymbolsOutlined_400Regular';
const FONT_FILLED = 'MaterialSymbolsOutlined_400Regular_Filled';

export function Icon({
  name,
  size = 22,
  color = colors.text,
  filled = false,
  style,
}: {
  /** örn. menu, search, volume_up, gif_box — web ile aynı */
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      accessibilityLabel={name}
      style={[
        {
          fontFamily: filled ? FONT_FILLED : FONT,
          fontSize: size,
          color,
          lineHeight: size + 2,
          includeFontPadding: false,
          textAlign: 'center',
        },
        style,
      ]}
    >
      {name}
    </Text>
  );
}
