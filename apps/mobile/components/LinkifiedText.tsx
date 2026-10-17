import { memo, useMemo } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import * as Linking from 'expo-linking';
import { colors } from '@dracord/app-theme';
import { tokenizeMessageContent } from '../lib/tokenizeMessageContent';

type Props = {
  content: string;
  style?: TextStyle;
  numberOfLines?: number;
  mentionNames?: string[];
  channelNames?: string[];
} & Pick<TextProps, 'onPress'>;

export const LinkifiedText = memo(function LinkifiedText({
  content,
  style,
  numberOfLines,
  mentionNames,
  channelNames,
  onPress,
}: Props) {
  const tokens = useMemo(
    () => tokenizeMessageContent(content, { mentionNames, channelNames }),
    [content, mentionNames, channelNames],
  );

  return (
    <Text
      style={[{ color: colors.text, lineHeight: 20 }, style]}
      numberOfLines={numberOfLines}
      onPress={onPress}
    >
      {tokens.map((t, i) => {
        if (t.type === 'url') {
          return (
            <Text
              key={i}
              style={urlStyle}
              onPress={(e) => {
                e.stopPropagation?.();
                void Linking.openURL(t.value);
              }}
            >
              {t.value}
            </Text>
          );
        }
        if (t.type === 'mention' || t.type === 'channel') {
          return (
            <Text key={i} style={mentionStyle}>
              {t.value}
            </Text>
          );
        }
        if (t.type === 'slash') {
          return (
            <Text key={i} style={slashStyle}>
              {t.value}
            </Text>
          );
        }
        return <Text key={i}>{t.value}</Text>;
      })}
    </Text>
  );
});

const urlStyle = { color: colors.primary, textDecorationLine: 'underline' as const };
const mentionStyle = {
  color: colors.primary,
  backgroundColor: 'rgba(189,147,249,0.18)',
  fontWeight: '600' as const,
};
const slashStyle = {
  color: '#8be9fd',
  backgroundColor: 'rgba(139,233,253,0.12)',
  fontWeight: '600' as const,
};
