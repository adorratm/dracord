import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipBuffer } from '../lib/clip-recorder';
import { armClipHotkey, disarmClipHotkey } from '../lib/clip-hotkey';
import type { SavedClip } from '../lib/clip-store';

export type ClipState =
  | { kind: 'off' }
  | { kind: 'armed'; seconds: number; accelerator: string | null }
  | { kind: 'saving' }
  | { kind: 'saved'; path: string; seconds: number; clip: SavedClip }
  | { kind: 'error'; message: string };

/**
 * Ekran paylaşımı için anlık klip (A3). Yalnız desktop (dosyaya yazma main'de).
 * `getStream` odaktaki paylaşımın izlerini verir (kendi paylaşımın ya da izlediğin).
 */
export function useClipRecorder(
  shareKey: string | null,
  shareName: string,
  getStream: () => MediaStream | null,
) {
  const [state, setState] = useState<ClipState>({ kind: 'off' });
  const buf = useRef<ClipBuffer | null>(null);
  const getStreamRef = useRef(getStream);
  getStreamRef.current = getStream;
  const nameRef = useRef(shareName);
  nameRef.current = shareName;
  const api = typeof window !== 'undefined' ? window.dracordDesktop : undefined;
  const supported = Boolean(api?.saveClip) && typeof MediaRecorder !== 'undefined';

  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const disarm = useCallback(() => {
    buf.current?.stop();
    buf.current = null;
    disarmClipHotkey('share');
    setState({ kind: 'off' });
  }, [api]);

  const arm = useCallback(async () => {
    const stream = getStreamRef.current();
    if (!stream) {
      setState({ kind: 'error', message: 'Paylaşım görüntüsü henüz hazır değil' });
      return;
    }
    buf.current?.stop();
    const b = new ClipBuffer(stream);
    b.start();
    buf.current = b;
    const accel = await armClipHotkey('share', () => void saveRef.current());
    setState({ kind: 'armed', seconds: 0, accelerator: accel });
  }, [api]);

  const save = useCallback(async () => {
    const b = buf.current;
    if (!b || !api?.saveClip) return;
    if (b.bufferedSeconds < 3) return;
    setState({ kind: 'saving' });
    try {
      const out = await b.clip();
      if (!out) throw new Error('Kayıt alınamadı');
      const data = new Uint8Array(await out.blob.arrayBuffer());
      const r = await api.saveClip(data, nameRef.current || 'klip');
      if (!r.ok || !r.path) throw new Error(r.error || 'Kaydedilemedi');
      setState({ kind: 'saved', path: r.path, seconds: out.seconds, clip: { blob: out.blob, seconds: out.seconds, path: r.path, name: nameRef.current || 'klip' } });
      setTimeout(() => {
        if (buf.current === b) setState((s) => (s.kind === 'saved' ? { kind: 'armed', seconds: b.bufferedSeconds, accelerator: 'Control+Shift+K' } : s));
      }, 12000);
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Klip kaydedilemedi' });
      setTimeout(() => buf.current === b && setState({ kind: 'armed', seconds: b.bufferedSeconds, accelerator: null }), 4000);
    }
  }, [api]);

  saveRef.current = save;

  // Paylaşım değişti / bitti → arabelleği kapat
  useEffect(() => {
    if (!shareKey) disarm();
    return () => {
      buf.current?.stop();
      buf.current = null;
      disarmClipHotkey('share');
    };
  }, [shareKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arabellek süresi göstergesi
  useEffect(() => {
    if (state.kind !== 'armed') return;
    const t = setInterval(() => {
      const s = buf.current?.bufferedSeconds ?? 0;
      setState((prev) => (prev.kind === 'armed' ? { ...prev, seconds: s } : prev));
    }, 1000);
    return () => clearInterval(t);
  }, [state.kind]);


  return {
    supported,
    state,
    arm,
    disarm,
    save,
    openFolder: (p?: string) => void api?.openClipsFolder?.(p ?? null),
  };
}
