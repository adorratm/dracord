/** Metindeki @/# mention, bot slash komutu ve URL parçalarını ayırır. */
export function tokenizeMessageContent(
  content: string,
  opts: { mentionNames?: string[]; channelNames?: string[] } = {},
): Array<{ type: 'text' | 'mention' | 'channel' | 'url' | 'slash'; value: string }> {
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionNames = ['everyone', 'all', ...(opts.mentionNames ?? [])].filter(Boolean);
  const uniqueMentions = [...new Set(mentionNames.map((n) => n.trim()).filter(Boolean))];
  const channelNames = [...new Set((opts.channelNames ?? []).map((n) => n.trim()).filter(Boolean))];

  const parts: Array<{
    type: 'text' | 'mention' | 'channel' | 'url' | 'slash';
    value: string;
  }> = [];
  const patterns: string[] = [];
  patterns.push(
    `(?:^|\\n)/(?:threads|thread|oynat|play|atla|skip|duraklat|pause|devam|resume|durdur|stop|kuyruk|queue|ses|volume|kaldir|remove)\\b[^\\n]*`,
  );
  patterns.push(`@threads(?![a-zA-Z0-9_])`);
  if (uniqueMentions.length) {
    patterns.push(`@(?:${uniqueMentions.map(escapeRegExp).join('|')})(?![a-zA-Z0-9_])`);
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
    if (
      /^\/(?:threads|thread|oynat|play|atla|skip|duraklat|pause|devam|resume|durdur|stop|kuyruk|queue|ses|volume|kaldir|remove)\b/i.test(
        chunk.trimStart(),
      )
    ) {
      parts.push({ type: 'slash', value: chunk });
      continue;
    }
    if (/^@threads$/i.test(chunk)) {
      parts.push({ type: 'slash', value: chunk });
      continue;
    }
    if (/^@(?:everyone|all)$/i.test(chunk)) {
      parts.push({ type: 'mention', value: chunk });
      continue;
    }
    if (
      chunk.startsWith('@') &&
      uniqueMentions.some((n) => chunk.slice(1).toLowerCase() === n.toLowerCase())
    ) {
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
      const trailing = chunk.slice(parts[parts.length - 1]!.value.length);
      if (trailing) parts.push({ type: 'text', value: trailing });
      continue;
    }
    parts.push({ type: 'text', value: chunk });
  }
  return parts;
}
