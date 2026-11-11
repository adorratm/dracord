import { API_URL, accessToken } from './env';

/** Test içinden API çağrısı (tarayıcıdan bağımsız — çevrimdışı senaryolarında da çalışır) */
export async function api<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken()}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

type Msg = { id: string; content: string; attachments?: Array<{ url: string }> };

export async function sendMessage(channelId: string, content: string): Promise<Msg> {
  return api<Msg>(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
}

export async function latestMessages(channelId: string, limit = 20): Promise<Msg[]> {
  const raw = await api<{ items: Msg[] } | Msg[]>(`/channels/${channelId}/messages?limit=${limit}`);
  return Array.isArray(raw) ? raw : raw.items;
}

export async function deleteMessage(id: string) {
  await api(`/messages/${id}`, { method: 'DELETE' }).catch(() => undefined);
}

/** Testin bıraktığı mesajları temizle: bu hesabın `since` sonrasında yazdıkları */
export async function cleanup(channelId: string, myUserId: string, since: number) {
  const items = (await latestMessages(channelId, 50).catch(() => [])) as Array<
    Msg & { author?: { id: string }; createdAt?: string }
  >;
  for (const m of items) {
    if (m.author?.id !== myUserId) continue;
    if (!m.createdAt || new Date(m.createdAt).getTime() < since - 2000) continue;
    await deleteMessage(m.id);
  }
}

export async function me(): Promise<{ id: string; displayName: string }> {
  return api('/auth/me');
}
