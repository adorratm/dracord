/**
 * WebM klip süresi + gerçek zamanlı kırpma (C7). MediaRecorder çıktısında süre başlığı yok;
 * süre "sona sar" hilesiyle okunur. Kırpma: aralık oynatılırken yeniden kaydedilir (≤ 60 sn, ek kütüphane yok).
 */
export async function readClipDuration(v: HTMLVideoElement, fallback: number): Promise<number> {
  if (Number.isFinite(v.duration) && v.duration > 0) return v.duration;
  return new Promise<number>((resolve) => {
    const done = () => {
      v.removeEventListener('durationchange', onChange);
      const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : fallback;
      v.currentTime = 0;
      resolve(d);
    };
    const onChange = () => {
      if (Number.isFinite(v.duration)) done();
    };
    v.addEventListener('durationchange', onChange);
    v.currentTime = 1e7;
    setTimeout(done, 3000);
  });
}

function pickMime(hasAudio: boolean) {
  const c = hasAudio ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return c.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
}

export async function trimClip(
  src: Blob,
  start: number,
  end: number,
  opts: { videoBitsPerSecond?: number; onProgress?: (p: number) => void } = {},
): Promise<Blob> {
  const url = URL.createObjectURL(src);
  const v = document.createElement('video');
  v.src = url;
  v.playsInline = true;
  v.preload = 'auto';
  const ctx = new AudioContext();
  try {
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res();
      v.onerror = () => rej(new Error('Klip açılamadı'));
    });
    // Ses: hoparlöre değil yalnız kayda
    const dest = ctx.createMediaStreamDestination();
    ctx.createMediaElementSource(v).connect(dest);
    const cap = (v as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
    v.currentTime = start;
    await new Promise<void>((res) => {
      v.onseeked = () => res();
    });
    const tracks = [...cap.getVideoTracks()];
    const audio = dest.stream.getAudioTracks();
    tracks.push(...audio);
    const stream = new MediaStream(tracks);
    const mime = pickMime(audio.length > 0);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: opts.videoBitsPerSecond ?? 4_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((res) => {
      rec.onstop = () => res();
    });
    await ctx.resume();
    rec.start(500);
    await v.play();
    await new Promise<void>((res) => {
      const tick = () => {
        opts.onProgress?.(Math.min(1, Math.max(0, (v.currentTime - start) / Math.max(0.1, end - start))));
        if (v.currentTime >= end || v.ended) return res();
        setTimeout(tick, 50);
      };
      tick();
    });
    v.pause();
    rec.stop();
    await stopped;
    opts.onProgress?.(1);
    return new Blob(chunks, { type: 'video/webm' });
  } finally {
    v.removeAttribute('src');
    v.load();
    URL.revokeObjectURL(url);
    void ctx.close();
  }
}
