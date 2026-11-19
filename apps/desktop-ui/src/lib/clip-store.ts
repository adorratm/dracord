/** Son kaydedilen klip + düzenleyici durumu (C7) — paylaşım klibi ve bağımsız klip ortak */
export type SavedClip = { blob: Blob; seconds: number; path: string; name: string };

let editing: SavedClip | null = null;
const subs = new Set<() => void>();

export const clipStore = {
  get editing() {
    return editing;
  },
  openEditor(c: SavedClip) {
    editing = c;
    subs.forEach((f) => f());
  },
  closeEditor() {
    editing = null;
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};
