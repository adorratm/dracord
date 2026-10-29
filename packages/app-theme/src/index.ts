/** Dracord istemci renkleri (web / desktop / mobile) */

export type ThemeMode = 'dark' | 'light';

const dark = {
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

/** Web `html.light` ile uyumlu açık palet */
const light = {
  bg: '#f2f3f5',
  surface: '#ffffff',
  surfaceHigh: '#e3e5e8',
  primary: '#5865f2',
  primaryOn: '#ffffff',
  success: '#23a559',
  danger: '#da373c',
  text: '#060607',
  textMuted: '#4e5058',
  outline: '#80848e',
  rail: '#e3e5e8',
  online: '#23a559',
  idle: '#f0b232',
  dnd: '#f23f43',
  offline: '#80848e',
} as const;

export const palettes = { dark, light } as const;
export type AppColors = { readonly [K in keyof typeof dark]: string };

let mode: ThemeMode = 'dark';
const listeners = new Set<() => void>();

export function getThemeMode(): ThemeMode {
  return mode;
}

export function setThemeMode(next: ThemeMode) {
  if (mode === next) return;
  mode = next;
  for (const l of listeners) l();
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Aktif temaya göre canlı renkler (Proxy — her okumada güncel palet) */
export const colors: AppColors = new Proxy({} as AppColors, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== 'string') return undefined;
    return palettes[mode][prop as keyof typeof dark];
  },
  ownKeys() {
    return Object.keys(palettes[mode]);
  },
  getOwnPropertyDescriptor(_t, prop) {
    if (typeof prop !== 'string' || !(prop in palettes[mode])) return undefined;
    return { enumerable: true, configurable: true, value: palettes[mode][prop as keyof typeof dark] };
  },
});

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

/** Kullanıcı tema pack’leri (Nitro özel pack’ler işaretli) */
export type ThemePackId = 'default' | 'midnight' | 'rose' | 'forest' | 'nitro-aurora';

export type ThemePackMeta = {
  id: ThemePackId;
  label: string;
  /** Nitro gerekir */
  nitroOnly?: boolean;
  /** CSS değişkenleri (primary accent) */
  vars: { primary: string; glow?: string };
};

export const THEME_PACKS: ThemePackMeta[] = [
  { id: 'default', label: 'Dracula', vars: { primary: '#bd93f9' } },
  { id: 'midnight', label: 'Gece Mavisi', vars: { primary: '#8be9fd' } },
  { id: 'rose', label: 'Gül', vars: { primary: '#ff79c6' } },
  { id: 'forest', label: 'Orman', vars: { primary: '#50fa7b' } },
  {
    id: 'nitro-aurora',
    label: 'Aurora (Nitro)',
    nitroOnly: true,
    vars: { primary: '#ffb86c', glow: '#bd93f9' },
  },
];

export function getThemePack(id: string | null | undefined): ThemePackMeta {
  return THEME_PACKS.find((p) => p.id === id) ?? THEME_PACKS[0]!;
}
