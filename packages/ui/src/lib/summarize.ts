/**
 * Cihaz üstü özet — tarayıcı yerleşik Summarizer API (Chrome 138+ masaüstü, uygun donanım).
 * Sunucu/API maliyeti yok. Yoksa `summarizerSupported()` false döner, UI düğmeyi gizler.
 */
type Av = 'available' | 'downloadable' | 'downloading' | 'unavailable';
type SummarizerStatic = {
  availability(o?: Record<string, unknown>): Promise<Av>;
  create(o: Record<string, unknown>): Promise<{ summarize(t: string, o?: { context?: string }): Promise<string>; destroy?: () => void }>;
};

function api(): SummarizerStatic | undefined {
  if (typeof self === 'undefined') return undefined;
  return (self as unknown as { Summarizer?: SummarizerStatic }).Summarizer;
}

export async function summarizerSupported(): Promise<boolean> {
  const S = api();
  if (!S) return false;
  try {
    return (await S.availability()) !== 'unavailable';
  } catch {
    return false;
  }
}

/** Kullanıcı tıklamasıyla çağır (model indirme izni). */
export async function summarizeOnDevice(
  text: string,
  opts?: { onProgress?: (p: number) => void; language?: string },
): Promise<string> {
  const S = api();
  if (!S) throw new Error('unsupported');
  const lang = opts?.language ?? 'tr';
  const base = {
    type: 'key-points',
    format: 'plain-text',
    length: 'medium',
    sharedContext: 'Bir sohbet kanalındaki mesajlar. Kısa maddelerle özetle.',
    monitor(m: EventTarget) {
      m.addEventListener('downloadprogress', (e) => {
        const l = (e as Event & { loaded?: number }).loaded;
        if (typeof l === 'number') opts?.onProgress?.(l);
      });
    },
  };
  let inst;
  try {
    inst = await S.create({ ...base, expectedInputLanguages: [lang, 'en'], outputLanguage: lang });
  } catch {
    // Dil desteklenmiyorsa varsayılan dilde dene
    inst = await S.create(base);
  }
  try {
    // Bağlam penceresi sınırlı: son ~12k karakter
    return await inst.summarize(text.slice(-12_000));
  } finally {
    inst.destroy?.();
  }
}
