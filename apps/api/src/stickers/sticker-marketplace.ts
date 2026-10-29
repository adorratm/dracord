/** Kürate sticker / emoji pack’leri (marketplace MVP) */

export type MarketSticker = {
  id: string;
  kind: 'emoji' | 'image';
  value: string;
  label: string;
};

export type MarketPack = {
  id: string;
  name: string;
  description: string;
  nitroOnly?: boolean;
  stickers: MarketSticker[];
};

export const STICKER_MARKET_PACKS: MarketPack[] = [
  {
    id: 'dracula-mood',
    name: 'Dracula Mood',
    description: 'Klasik Dracula tepkileri',
    stickers: [
      { id: 'dm-1', kind: 'emoji', value: '🦇', label: 'Yarasa' },
      { id: 'dm-2', kind: 'emoji', value: '💜', label: 'Mor kalp' },
      { id: 'dm-3', kind: 'emoji', value: '✨', label: 'Parıltı' },
      { id: 'dm-4', kind: 'emoji', value: '🔥', label: 'Ateş' },
      { id: 'dm-5', kind: 'emoji', value: '😎', label: 'Cool' },
    ],
  },
  {
    id: 'game-night',
    name: 'Oyun Gecesi',
    description: 'Masa oyunu tepkileri',
    stickers: [
      { id: 'gn-1', kind: 'emoji', value: '🎲', label: 'Zar' },
      { id: 'gn-2', kind: 'emoji', value: '♠️', label: 'Maça' },
      { id: 'gn-3', kind: 'emoji', value: '🎯', label: 'Hedef' },
      { id: 'gn-4', kind: 'emoji', value: '🏆', label: 'Kupa' },
    ],
  },
  {
    id: 'nitro-sparkle',
    name: 'Nitro Sparkle',
    description: 'Nitro abonelerine özel',
    nitroOnly: true,
    stickers: [
      { id: 'ns-1', kind: 'emoji', value: '🌟', label: 'Yıldız' },
      { id: 'ns-2', kind: 'emoji', value: '💎', label: 'Elmas' },
      { id: 'ns-3', kind: 'emoji', value: '🚀', label: 'Roket' },
    ],
  },
];
