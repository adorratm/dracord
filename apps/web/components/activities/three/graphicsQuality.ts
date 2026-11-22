/**
 * Oyun grafik kalitesi (Three.js): Otomatik / Yüksek / Ultra / Düşük.
 * Otomatik: cihazın tam çözünürlüğüyle başlar (telefonda 3x'e kadar), kare hızı düşerse çözünürlüğü
 * kademeli indirir, toparlanınca geri çıkarır (dinamik çözünürlük). Seçim cihazda saklanır.
 */
export type GraphicsQuality = 'auto' | 'high' | 'ultra' | 'low';
export const GRAPHICS_LABEL: Record<GraphicsQuality, string> = {
  auto: 'Otomatik',
  high: 'Yüksek',
  ultra: 'Ultra',
  low: 'Düşük',
};
export const GRAPHICS_ORDER: GraphicsQuality[] = ['auto', 'high', 'ultra', 'low'];

const KEY = 'dracord.game-graphics';
const subs = new Set<() => void>();

export function getGraphicsQuality(): GraphicsQuality {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'high' || v === 'ultra' || v === 'low' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function setGraphicsQuality(q: GraphicsQuality) {
  try {
    localStorage.setItem(KEY, q);
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}

export function onGraphicsQualityChange(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export interface GraphicsProfile {
  /** en yüksek piksel oranı */
  maxDpr: number;
  /** başlangıç / alt sınır (otomatik indirirken) */
  minDpr: number;
  shadowMap: number;
  antialias: boolean;
  /** kare hızına göre çözünürlüğü ayarla */
  adaptive: boolean;
}

function isTouchDevice() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function graphicsProfile(q: GraphicsQuality = getGraphicsQuality()): GraphicsProfile {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const touch = isTouchDevice();
  // Telefonlar 2.6–3.5 DPR: 2'de kesmek metni/kenarları bulanık gösteriyordu
  const deviceMax = Math.min(dpr, touch ? 3 : 2.5);
  switch (q) {
    case 'low':
      return { maxDpr: 1, minDpr: 1, shadowMap: 1024, antialias: false, adaptive: false };
    case 'high':
      return { maxDpr: Math.min(deviceMax, 2), minDpr: Math.min(deviceMax, 2), shadowMap: 2048, antialias: true, adaptive: false };
    case 'ultra':
      return { maxDpr: deviceMax, minDpr: deviceMax, shadowMap: 4096, antialias: true, adaptive: false };
    default:
      // Telefonda 2x'in altına inme: uzaktaki masa/taşlar pikselleşiyordu
      return { maxDpr: deviceMax, minDpr: Math.min(deviceMax, touch ? 2 : 1.25), shadowMap: 2048, antialias: true, adaptive: true };
  }
}
