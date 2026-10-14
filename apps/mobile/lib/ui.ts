import { colors } from '@dracord/app-theme';
import type { TextStyle, ViewStyle } from 'react-native';

export const inputStyle: ViewStyle & TextStyle = {
  height: 44,
  borderRadius: 12,
  paddingHorizontal: 12,
  backgroundColor: colors.surfaceHigh,
  color: colors.text,
};

export const primaryBtn: ViewStyle = {
  height: 44,
  borderRadius: 12,
  backgroundColor: colors.primary,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 16,
};

export const primaryBtnText: TextStyle = {
  color: colors.primaryOn,
  fontWeight: '700',
};

export const statusColor: Record<string, string> = {
  ONLINE: colors.online,
  IDLE: colors.idle,
  DND: colors.dnd,
  OFFLINE: colors.offline,
};
