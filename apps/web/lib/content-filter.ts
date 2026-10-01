/** Basit uygunsuz kelime / şüpheli medya filtresi (istemci). */

const BLOCKED =
  /\b(amk|aq|a\.q|oç|orspu|siktir|sikerim|göt|piç|fuck|shit|bitch|cunt|nigger|faggot)\b/giu;

const SUSPICIOUS_HOST =
  /(porn|xxx|xvideos|pornhub|onlyfans|nsfw|hentai|xnxx)/i;

export function censorExplicitText(input: string): string {
  return input.replace(BLOCKED, (m) => '*'.repeat(Math.min(m.length, 8)));
}

export function isSuspiciousUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return SUSPICIOUS_HOST.test(host) || SUSPICIOUS_HOST.test(url);
  } catch {
    return SUSPICIOUS_HOST.test(url);
  }
}

export function filterMessageContent(
  content: string,
  enabled: boolean,
): string {
  if (!enabled) return content;
  return censorExplicitText(content);
}
