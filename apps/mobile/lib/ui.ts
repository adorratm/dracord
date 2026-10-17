import { colors } from '@dracord/app-theme';
import type { TextStyle, ViewStyle } from 'react-native';

/** Tema değişince güncel kalsın diye getter kullan */
export const inputStyle: ViewStyle & TextStyle = {
  height: 44,
  borderRadius: 12,
  paddingHorizontal: 12,
  get backgroundColor() {
    return colors.surfaceHigh;
  },
  get color() {
    return colors.text;
  },
};

export const primaryBtn: ViewStyle = {
  height: 44,
  borderRadius: 12,
  get backgroundColor() {
    return colors.primary;
  },
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 16,
};

export const primaryBtnText: TextStyle = {
  get color() {
    return colors.primaryOn;
  },
  fontWeight: '700',
};

export const statusColor: Record<string, string> = {
  get ONLINE() {
    return colors.online;
  },
  get IDLE() {
    return colors.idle;
  },
  get DND() {
    return colors.dnd;
  },
  get OFFLINE() {
    return colors.offline;
  },
};
