/** a request that never got an answer (offline, DNS, blocked, connection reset) — not a refusal */
export function isNetworkFailure(err: unknown): boolean {
  // an ApiError (has a numeric status): the server answered
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && err instanceof Error && err.name !== 'TypeError') return status === 0 || status >= 500;
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '');
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|ECONN|ENOTFOUND|aborted/i.test(msg);
}

/**
 * Run `fn`, retrying while it fails for network reasons (waits 0.8 s, 1.6 s, 3.2 s …).
 * A real answer from the server (401, 403, 404 …) is returned / thrown straight away.
 */
export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  opts: { tries?: number; baseMs?: number; onRetry?: (attempt: number) => void; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const tries = Math.max(1, opts.tries ?? 4);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    if (i > 0) {
      opts.onRetry?.(i);
      await sleep((opts.baseMs ?? 800) * 2 ** (i - 1));
    }
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isNetworkFailure(err)) throw err;
    }
  }
  throw last;
}
