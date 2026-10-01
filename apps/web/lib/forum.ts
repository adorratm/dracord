/** Forum gönderilerinden #etiket çıkarımı */

export function extractForumTags(content: string): string[] {
  const tags = new Set<string>();
  const re = /(^|\s)#([a-zA-Z0-9çğıöşüÇĞİÖŞÜ_-]{2,24})/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    tags.add(m[2]!.toLowerCase());
  }
  return [...tags];
}

export type ForumSort = 'newest' | 'oldest' | 'pinned';

export function sortForumMessages<
  T extends { pinnedAt?: string | null; createdAt: string; content: string },
>(messages: T[], sort: ForumSort, tag: string | null): T[] {
  let list = [...messages];
  if (tag) {
    list = list.filter((m) => extractForumTags(m.content).includes(tag));
  }
  if (sort === 'oldest') {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } else if (sort === 'pinned') {
    list.sort((a, b) => {
      const ap = a.pinnedAt ? 1 : 0;
      const bp = b.pinnedAt ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return b.createdAt.localeCompare(a.createdAt);
    });
  } else {
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return list;
}
