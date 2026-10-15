/** Dracord istemci renkleri (web / desktop / mobile) */
export const colors = {
  bg: '#11131e',
  surface: '#1a1c2c',
  surfaceHigh: '#282a36',
  primary: '#bd93f9',
  primaryOn: '#11131e',
  success: '#50fa7b',
  danger: '#ff5555',
  text: '#f8f8f2',
  textMuted: '#ccc3d3',
  outline: '#6272a4',
  rail: '#0c0d14',
  online: '#50fa7b',
  idle: '#f1fa8c',
  dnd: '#ff5555',
  /** Web/desktop `bg-outline` (#968e9c) — Dracula comment mavisi değil */
  offline: '#968e9c',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;
