import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@dracord/app-theme';
import { Icon } from '../Icon';

const EASE = Easing.out(Easing.cubic);

/** Hafif slide drawer — web MobileDrawer hissi, ağır fade yok */
export function Drawer({
  open,
  onClose,
  side = 'left',
  title,
  width = 300,
  /** 0–1; verilirse ekranın bu oranına kadar genişler (width ile min alınır) */
  maxScreenRatio = 0.88,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  title?: string;
  width?: number;
  maxScreenRatio?: number;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const panelW = Math.min(width, Math.round(screenW * maxScreenRatio));
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.value = withTiming(1, { duration: 200, easing: EASE });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 160, easing: EASE }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [open, mounted, progress]);

  const panelStyle = useAnimatedStyle(() => {
    const off = (1 - progress.value) * panelW * (side === 'left' ? -1 : 1);
    return { transform: [{ translateX: off }] };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.45,
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, flexDirection: side === 'right' ? 'row-reverse' : 'row' }}>
        <Animated.View style={[{ width: panelW, zIndex: 2 }, panelStyle]}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              borderRightWidth: side === 'left' ? 1 : 0,
              borderLeftWidth: side === 'right' ? 1 : 0,
              borderColor: colors.surfaceHigh,
            }}
          >
            {title ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.surfaceHigh,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                  {title}
                </Text>
                <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
                  <Icon name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}
            <View style={{ flex: 1, minHeight: 0, flexDirection: 'column' }}>{children}</View>
          </View>
        </Animated.View>
        <Pressable style={{ flex: 1 }} onPress={onClose}>
          <Animated.View
            style={[
              { flex: 1, backgroundColor: '#000' },
              backdropStyle,
            ]}
          />
        </Pressable>
      </View>
    </Modal>
  );
}
