import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { UserActivity } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { openActivityUrl } from '../lib/openActivityUrl';
import { activityLineTr } from '../lib/presence';
import { Icon } from './Icon';

/**
 * Uzun şarkı / oyun adları — taşınca kaydır.
 * Not: numberOfLines=1 içinde onLayout tam genişlik vermez; gizli Text ile ölçülür.
 */
function MarqueeLabel({
  text,
  style,
  color,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  color: string;
}) {
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);
  const tx = useRef(new Animated.Value(0)).current;
  const overflow = textW > boxW + 8 && boxW > 0 && textW > 0;

  useEffect(() => {
    tx.stopAnimation();
    tx.setValue(0);
    if (!overflow) return;

    const distance = textW - boxW + 16;
    const duration = Math.max(4000, Math.min(18000, distance * 45));
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(tx, {
          toValue: -distance,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(tx, {
          toValue: 0,
          duration: 1,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      tx.setValue(0);
    };
  }, [overflow, textW, boxW, text, tx]);

  return (
    <View
      style={{ flex: 1, minWidth: 0, overflow: 'hidden', justifyContent: 'center' }}
      onLayout={(e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - boxW) > 0.5) setBoxW(w);
      }}
    >
      {/* Tam metin genişliği — kısıtsız, görünmez */}
      <Text
        style={[
          {
            position: 'absolute',
            opacity: 0,
            left: 0,
            top: 0,
            zIndex: -1,
          },
          style,
          { color },
        ]}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - textW) > 0.5) setTextW(w);
        }}
      >
        {text}
      </Text>

      <Animated.View
        style={{
          flexDirection: 'row',
          transform: [{ translateX: overflow ? tx : 0 }],
          width: overflow ? textW : undefined,
        }}
      >
        <Text numberOfLines={1} style={[{ color }, style]}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Üye / profil / arkadaş — kapak + kayan yazı + Spotify/Steam link */
export function ActivityLine({
  activity,
  style,
  textStyle,
  imageSize = 14,
  showImage = true,
  color = colors.success,
}: {
  activity?: UserActivity | null;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  imageSize?: number;
  showImage?: boolean;
  color?: string;
}) {
  const line = activityLineTr(activity);
  if (!line || !activity) return null;
  const url = activity.url?.trim() || null;

  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          minWidth: 0,
          flex: 1,
          width: '100%',
        },
        style,
      ]}
    >
      {showImage && imageSize > 0 && activity.imageUrl ? (
        <Image
          source={{ uri: activity.imageUrl }}
          style={{
            width: imageSize,
            height: imageSize,
            borderRadius: 3,
            backgroundColor: colors.surfaceHigh,
          }}
        />
      ) : null}
      <MarqueeLabel
        text={line}
        color={color}
        style={[{ fontSize: 12, fontWeight: '600' }, textStyle]}
      />
      {url ? (
        <Icon
          name={activity.source === 'spotify' ? 'headphones' : 'open_in_new'}
          size={12}
          color={color}
        />
      ) : null}
    </View>
  );

  if (url) {
    return (
      <Pressable
        onPress={() => {
          void openActivityUrl(url);
        }}
        hitSlop={4}
        style={{ flex: 1, minWidth: 0, width: '100%' }}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}
