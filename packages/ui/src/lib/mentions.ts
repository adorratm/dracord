export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Metindeki @/# mention ve URL parçalarını ayırır. */
export function tokenizeMessageContent(
  content: string,
  opts: { mentionNames?: string[]; channelNames?: string[] } = {},
): Array<{ type: 'text' | 'mention' | 'channel' | 'url'; value: string }> {
  const mentionNames = [
    'everyone',
    'all',
    ...(opts.mentionNames ?? []),
  ].filter(Boolean);
  const uniqueMentions = [...new Set(mentionNames.map((n) => n.trim()).filter(Boolean))];
  const channelNames = [...new Set((opts.channelNames ?? []).map((n) => n.trim()).filter(Boolean))];

  const parts: Array<{ type: 'text' | 'mention' | 'channel' | 'url'; value: string }> = [];
  const patterns: string[] = [];
  if (uniqueMentions.length) {
    patterns.push(
      `@(?:${uniqueMentions.map(escapeRegExp).join('|')})(?![a-zA-Z0-9_])`,
    );
  } else {
    patterns.push(`@(?:everyone|all)(?![a-zA-Z0-9_])`);
  }
  if (channelNames.length) {
    patterns.push(`#(?:${channelNames.map(escapeRegExp).join('|')})(?![a-zA-Z0-9_-])`);
  }
  patterns.push(`https?:\\/\\/[^\\s<>"'\\)\\]]+`);

  const re = new RegExp(`(${patterns.join('|')})`, 'gi');
  const chunks = content.split(re);
  for (const chunk of chunks) {
    if (!chunk) continue;
    if (/^@(?:everyone|all)$/i.test(chunk)) {
      parts.push({ type: 'mention', value: chunk });
      continue;
    }
    if (chunk.startsWith('@') && uniqueMentions.some((n) => chunk.slice(1).toLowerCase() === n.toLowerCase())) {
      parts.push({ type: 'mention', value: chunk });
      continue;
    }
    if (
      chunk.startsWith('#') &&
      channelNames.some((n) => chunk.slice(1).toLowerCase() === n.toLowerCase())
    ) {
      parts.push({ type: 'channel', value: chunk });
      continue;
    }
    if (/^https?:\/\//i.test(chunk)) {
      parts.push({ type: 'url', value: chunk.replace(/[.,;:!?)]+$/, '') });
      // trailing punctuation left as text if stripped
      const trailing = chunk.slice(parts[parts.length - 1]!.value.length);
      if (trailing) parts.push({ type: 'text', value: trailing });
      continue;
    }
    parts.push({ type: 'text', value: chunk });
  }
  return parts;
}

export function contentHasSelfMention(
  content: string,
  mentionNames: string[],
): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  if (/(^|[\s])@(everyone|all)\b/.test(lower)) return true;
  return mentionNames.some((n) => {
    const needle = `@${n.toLowerCase()}`;
    const idx = lower.indexOf(needle);
    if (idx < 0) return false;
    const after = lower[idx + needle.length];
    return !after || /[^a-z0-9_]/i.test(after);
  });
}
