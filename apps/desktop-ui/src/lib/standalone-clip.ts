import { ClipBuffer } from './clip-recorder';
import { armClipHotkey, disarmClipHotkey } from './clip-hotkey';
import { clipStore, type SavedClip } from './clip-store';

/**
 * Bağımsız klip (C7): ekran paylaşımı / ses kanalı gerekmeden bir oyun penceresini ya da
 * ekranı yerel olarak arabelleğe alır. Hiçbir şey yayınlanmaz; Ctrl+Shift+K son 30–60 sn'yi kaydeder.
 */
export type StandaloneClipState =
  | { kind: 'off' }
  | { kind: 'armed'; name: string; seconds: number; accelerator: string | null; saving?: boolean; last?: SavedClip; error?: string };

let state: StandaloneClipState = { kind: 'off' };
let stream: MediaStream | null = null;
let buf: ClipBuffer | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
const subs = new Set<() => void>();

function set(next: StandaloneClipState) {
  state = next;
  subs.forEach((f) => f());
}

export const standaloneClip = {
  get state() {
    return state;
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
  get supported() {
    const d = typeof window !== 'undefined' ? window.dracordDesktop : undefined;
    return Boolean(d?.saveClip && typeof d.getDesktopSources === 'function') && typeof MediaRecorder !== 'undefined';
  },

  /** Seçilen kaynaktan yakalamayı başlat (kaynak seçimi çağıranda) */
  async start(sel: { sourceId: string; systemAudio: boolean; name: string }) {
    const d = window.dracordDesktop;
    if (!d?.setDisplayMediaSelection) throw new Error('Yalnız masaüstü uygulamasında');
    this.stop();
    await d.setDisplayMediaSelection({ sourceId: sel.sourceId, systemAudio: sel.systemAudio });
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 60, max: 60 } },
      audio: sel.systemAudio,
    });
    stream = s;
    s.getVideoTracks()[0]?.addEventListener('ended', () => this.stop());
    buf = new ClipBuffer(s, { videoBitsPerSecond: 8_000_000 });
    buf.start();
    const accelerator = await armClipHotkey('standalone', () => void this.save());
    set({ kind: 'armed', name: sel.name, seconds: 0, accelerator });
    ticker = setInterval(() => {
      if (state.kind === 'armed' && buf) set({ ...state, seconds: buf.bufferedSeconds });
    }, 1000);
  },

  async save() {
    const d = window.dracordDesktop;
    if (state.kind !== 'armed' || !buf || !d?.saveClip || state.saving) return;
    if (buf.bufferedSeconds < 3) return;
    const name = state.name;
    set({ ...state, saving: true, error: undefined });
    try {
      const out = await buf.clip();
      if (!out) throw new Error('Kayıt alınamadı');
      const r = await d.saveClip(new Uint8Array(await out.blob.arrayBuffer()), name || 'klip');
      if (!r.ok || !r.path) throw new Error(r.error || 'Kaydedilemedi');
      if (state.kind === 'armed') set({ ...state, saving: false, last: { blob: out.blob, seconds: out.seconds, path: r.path, name } });
    } catch (e) {
      if (state.kind === 'armed') set({ ...state, saving: false, error: e instanceof Error ? e.message : 'Klip kaydedilemedi' });
    }
  },

  edit() {
    if (state.kind === 'armed' && state.last) clipStore.openEditor(state.last);
  },

  stop() {
    if (ticker) clearInterval(ticker);
    ticker = null;
    buf?.stop();
    buf = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    disarmClipHotkey('standalone');
    void window.dracordDesktop?.clearDisplayMediaSelection?.();
    if (state.kind !== 'off') set({ kind: 'off' });
  },
};
