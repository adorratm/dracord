import type { VoiceTokenResponse } from '@dracord/types';

/**
 * Joining a voice room: the LiveKit signal is a websocket to rtc.dracord.com.tr. Some
 * networks (a school / office proxy, a flaky mobile link, a resolver that does not know
 * the subdomain yet) drop that one connection while the rest of Dracord works. So:
 *   1. try the main address, then each fallback the server lists (the same LiveKit behind
 *      another address, e.g. api.dracord.com.tr/livekit);
 *   2. go round that list a second time after a short pause (transient blips);
 *   3. only a failure of the signal itself is retried — a refused token or a missing
 *      microphone is reported straight away.
 */

/** the addresses to try, main first, no duplicates */
export function voiceUrlCandidates(tok: Pick<VoiceTokenResponse, 'url' | 'fallbackUrls'>, override?: string | null): string[] {
  const out: string[] = [];
  for (const u of [override, tok.url, ...(tok.fallbackUrls ?? [])]) {
    const v = typeof u === 'string' ? u.trim() : '';
    if (v && /^wss?:\/\//i.test(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/** a failure to open the signal websocket (worth another address / another try) */
export function isVoiceSignalError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/401|403|unauthori[sz]ed|permission|not allowed|token/i.test(msg) && !/websocket/i.test(msg)) return false;
  return /signal connection|websocket|could not connect|failed to fetch|network|timed? ?out|ECONN|ENOTFOUND|1006/i.test(msg);
}

/** Turkish message for a signal failure that survived every retry */
export const VOICE_SIGNAL_FAILED_MESSAGE =
  'Ses sunucusuna bağlanılamadı. İnternet bağlantını kontrol edip tekrar dene — okul, iş yeri ya da bazı mobil ağlar ses bağlantısını engelleyebiliyor; başka bir ağda (ör. Wi-Fi yerine mobil veri) dene.';

export interface VoiceConnectOptions {
  /** rounds over the address list (default 2) */
  rounds?: number;
  /** pause between rounds, ms (default 1500) */
  pauseMs?: number;
  /** stop early (the user left / switched channel meanwhile) */
  cancelled?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  /** called before every attempt after the first (UI: "yeniden deneniyor…") */
  onRetry?: (attempt: number, url: string) => void;
}

/**
 * Run `connect(url)` over the candidate addresses until one works. Resolves with the
 * address that connected. Rejects with the last error — a signal failure is replaced by
 * VOICE_SIGNAL_FAILED_MESSAGE so the user sees what to do instead of a websocket code.
 */
export async function connectVoiceWithFallback(
  urls: string[],
  connect: (url: string) => Promise<void>,
  opts: VoiceConnectOptions = {},
): Promise<string> {
  const rounds = Math.max(1, opts.rounds ?? 2);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: unknown = new Error('no voice server address');
  let attempt = 0;
  for (let round = 0; round < rounds; round++) {
    if (round > 0) await sleep(opts.pauseMs ?? 1500);
    for (const url of urls) {
      if (opts.cancelled?.()) throw last instanceof Error ? last : new Error(String(last));
      if (attempt > 0) opts.onRetry?.(attempt, url);
      attempt++;
      try {
        await connect(url);
        return url;
      } catch (err) {
        last = err;
        if (!isVoiceSignalError(err)) throw err;
      }
    }
  }
  const e = new Error(VOICE_SIGNAL_FAILED_MESSAGE);
  (e as Error & { cause?: unknown }).cause = last;
  throw e;
}
