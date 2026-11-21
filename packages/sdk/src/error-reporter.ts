/**
 * İstemci hata raporlayıcı — kendi API'mize (POST /client-errors), ücretsiz Sentry yerine.
 * Tarayıcı, Electron ve React Native'de çalışır (yalnız fetch kullanır). Oturum başına en çok
 * 25 rapor, aynı hata bir kez; kişisel veri sunucuda ayrıca ayıklanır.
 */
export type ErrorPlatform = 'web' | 'desktop' | 'mobile' | 'admin';

export interface ErrorReporterOptions {
  apiUrl: string;
  platform: ErrorPlatform;
  version?: string;
  /** o anki sayfa/ekran (sorgu dizesi gönderilmez) */
  getPath?: () => string | undefined;
  agent?: string;
  /** Rapor gönderilmesin (geliştirme) */
  disabled?: boolean;
  /** Bu hatalar yok sayılır (tarayıcı eklentileri, iptal edilen istekler…) */
  ignore?: RegExp[];
}

const DEFAULT_IGNORE = [
  /ResizeObserver loop/i,
  /AbortError|The (user|operation) aborted|signal is aborted/i,
  /Non-Error promise rejection captured/i,
  /Load failed|Failed to fetch|NetworkError when attempting|Network request failed/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
  /^Script error\.?$/i,
];

const MAX_PER_SESSION = 25;

export function createErrorReporter(opts: ErrorReporterOptions) {
  const seen = new Set<string>();
  let sent = 0;
  let queue: Array<Record<string, string>> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const ignore = [...DEFAULT_IGNORE, ...(opts.ignore ?? [])];

  const flush = () => {
    timer = null;
    const batch = queue;
    queue = [];
    if (!batch.length) return;
    void fetch(`${opts.apiUrl.replace(/\/$/, '')}/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true,
    } as RequestInit).catch(() => undefined);
  };

  const report = (err: unknown, extra?: { message?: string }) => {
    if (opts.disabled || sent >= MAX_PER_SESSION) return;
    const e = err instanceof Error ? err : null;
    const message = (extra?.message ?? (e ? `${e.name}: ${e.message}` : String(err ?? ''))).slice(0, 1000);
    const stack = (e?.stack ?? '').slice(0, 6000);
    if (!message.trim() || ignore.some((r) => r.test(message) || r.test(stack))) return;
    const key = `${message}|${stack.split('\n')[1] ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent++;
    let path = '';
    try {
      path = (opts.getPath?.() ?? '').split('?')[0]!.slice(0, 300);
    } catch {
      /* ignore */
    }
    queue.push({ platform: opts.platform, message, stack, version: opts.version ?? '', path, agent: (opts.agent ?? '').slice(0, 300) });
    if (!timer) timer = setTimeout(flush, 2000);
  };

  return { report, flush };
}

/** Tarayıcı / Electron renderer: window.onerror + unhandledrejection */
export function installBrowserErrorReporter(opts: Omit<ErrorReporterOptions, 'getPath' | 'agent'>) {
  const g = globalThis as unknown as Window & { __dracordErrorReporter?: ReturnType<typeof createErrorReporter> };
  if (typeof window === 'undefined' || g.__dracordErrorReporter) return g.__dracordErrorReporter;
  const r = createErrorReporter({
    ...opts,
    getPath: () => window.location.pathname + (window.location.hash ? window.location.hash.split('?')[0] : ''),
    agent: navigator.userAgent,
  });
  window.addEventListener('error', (ev) => {
    // kaynak yükleme hataları (img/script 404) ErrorEvent değildir
    if (!(ev instanceof ErrorEvent)) return;
    r.report(ev.error ?? ev.message, ev.error ? undefined : { message: String(ev.message) });
  });
  window.addEventListener('unhandledrejection', (ev) => r.report(ev.reason));
  window.addEventListener('pagehide', () => r.flush());
  g.__dracordErrorReporter = r;
  return r;
}
