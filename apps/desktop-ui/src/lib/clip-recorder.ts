/**
 * Son ~30 sn klip (A3) — iki MediaRecorder 30 sn arayla, her biri 60 sn'de yeniden başlar.
 * WebM yalnız baştan oynatılabildiği için parça kesmek yerine "en az 30 sn önce başlamış"
 * kaydediciyi durdurup tam dosyayı alırız → klip 30–60 sn arası olur, CPU ek kodlama yapmaz.
 */
const SEGMENT_MS = 60_000;
const OFFSET_MS = 30_000;

function pickMime(hasAudio: boolean): string {
  const cands = hasAudio
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const c of cands) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  return 'video/webm';
}

type Slot = { rec: MediaRecorder; chunks: Blob[]; startedAt: number; timer: ReturnType<typeof setTimeout> | null };

export class ClipBuffer {
  private slots: Array<Slot | null> = [null, null];
  private offsetTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private readonly mime: string;
  private readonly bitrate: number;

  constructor(
    private readonly stream: MediaStream,
    opts?: { videoBitsPerSecond?: number },
  ) {
    this.mime = pickMime(stream.getAudioTracks().length > 0);
    this.bitrate = opts?.videoBitsPerSecond ?? 6_000_000;
  }

  start() {
    this.stopped = false;
    this.spawn(0);
    this.offsetTimer = setTimeout(() => this.spawn(1), OFFSET_MS);
  }

  private spawn(i: number) {
    if (this.stopped) return;
    const old = this.slots[i];
    if (old) {
      if (old.timer) clearTimeout(old.timer);
      try {
        if (old.rec.state !== 'inactive') old.rec.stop();
      } catch {
        /* ignore */
      }
    }
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: this.bitrate, audioBitsPerSecond: 128_000 });
    } catch {
      return;
    }
    const slot: Slot = { rec, chunks: [], startedAt: Date.now(), timer: null };
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) slot.chunks.push(e.data);
    };
    rec.start(1000);
    slot.timer = setTimeout(() => this.spawn(i), SEGMENT_MS);
    this.slots[i] = slot;
  }

  /** En uzun süredir çalışan kaydedicinin süresi (sn) */
  get bufferedSeconds(): number {
    const now = Date.now();
    return Math.floor(Math.max(0, ...this.slots.map((s) => (s ? now - s.startedAt : 0))) / 1000);
  }

  /** Klibi al: en eski kaydediciyi bitir, dosyayı döndür, o kaydediciyi yeniden başlat */
  async clip(): Promise<{ blob: Blob; seconds: number } | null> {
    const live = this.slots
      .map((s, i) => ({ s, i }))
      .filter((x): x is { s: Slot; i: number } => Boolean(x.s && x.s.rec.state === 'recording'))
      .sort((a, b) => a.s.startedAt - b.s.startedAt);
    const pick = live[0];
    if (!pick) return null;
    const { s, i } = pick;
    if (s.timer) clearTimeout(s.timer);
    const seconds = Math.round((Date.now() - s.startedAt) / 1000);
    const blob = await new Promise<Blob>((resolve) => {
      s.rec.onstop = () => resolve(new Blob(s.chunks, { type: this.mime.split(';')[0] }));
      try {
        s.rec.stop();
      } catch {
        resolve(new Blob(s.chunks, { type: 'video/webm' }));
      }
    });
    this.slots[i] = null;
    this.spawn(i);
    return blob.size > 0 ? { blob, seconds } : null;
  }

  stop() {
    this.stopped = true;
    if (this.offsetTimer) clearTimeout(this.offsetTimer);
    for (const s of this.slots) {
      if (!s) continue;
      if (s.timer) clearTimeout(s.timer);
      try {
        if (s.rec.state !== 'inactive') s.rec.stop();
      } catch {
        /* ignore */
      }
    }
    this.slots = [null, null];
  }
}
