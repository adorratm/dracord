import type { ActivitySessionDto } from '@dracord/types';
import type { Material, Mesh, Object3D, Texture } from 'three';

/** Tüm oyun bileşenlerinin ortak props'u */
export type GameProps = {
  session: ActivitySessionDto;
  userId: string | undefined;
  canPlay: boolean;
  onPatch: (state: Record<string, unknown>) => Promise<void>;
};

export function disposeMaterial(mat: Material) {
  for (const value of Object.values(mat as unknown as Record<string, unknown>)) {
    if (value && (value as Texture).isTexture) (value as Texture).dispose();
  }
  mat.dispose();
}

/** Bir alt ağacın geometri / materyal / texture kaynaklarını serbest bırakır */
export function disposeObject(root: Object3D) {
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as Material | Material[] | undefined;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach(disposeMaterial);
      else disposeMaterial(mat);
    }
  });
}

export function pointerNdc(e: { clientX: number; clientY: number }, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1,
    y: -((e.clientY - r.top) / Math.max(1, r.height)) * 2 + 1,
  };
}

export function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

/** Sıradaki oyuncu: turn % oyuncu sayısı */
export function turnIndex(session: ActivitySessionDto): number {
  const turn = Number(session.state.turn ?? 0);
  const n = Math.max(1, session.playerIds.length);
  return (Number.isFinite(turn) ? turn : 0) % n;
}

export function isMyTurn(p: GameProps): boolean {
  if (!p.canPlay || !p.userId) return false;
  const idx = p.session.playerIds.indexOf(p.userId);
  return idx >= 0 && idx === turnIndex(p.session);
}

export function playerLabel(session: ActivitySessionDto, id: string, userId?: string) {
  const idx = session.playerIds.indexOf(id);
  return `Oyuncu ${idx + 1}${id === userId ? ' (sen)' : ''}`;
}

export const DRACULA = {
  bg: '#11131e',
  felt: '#1f6b3f',
  purple: '#bd93f9',
  pink: '#ff79c6',
  cyan: '#8be9fd',
  green: '#50fa7b',
  orange: '#ffb86c',
  red: '#ff5555',
  yellow: '#f1fa8c',
  fg: '#f8f8f2',
  card: '#282a36',
} as const;
