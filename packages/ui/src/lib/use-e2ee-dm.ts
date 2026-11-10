'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChannelE2eeDto, E2eePayload, MessageDto } from '@dracord/types';
import { E2eeManager, type E2eeApi } from '@dracord/sdk';

export type E2eeDmClient = E2eeApi & {
  setChannelE2ee(channelId: string, enabled: boolean): Promise<ChannelE2eeDto>;
  sendEncryptedMessage(
    channelId: string,
    payload: E2eePayload,
    opts?: { replyToId?: string; threadRootId?: string },
  ): Promise<MessageDto>;
  onDmE2eeUpdate(h: (p: { channelId: string; enabled?: boolean; by?: string; devicesChangedBy?: string }) => void): () => void;
};

const managers = new Map<string, E2eeManager>();

/** Tarayıcı / Electron: localStorage depolu tekil yönetici */
export function browserE2eeManager(client: E2eeApi, userId: string, platform: 'web' | 'desktop'): E2eeManager {
  const key = `${platform}:${userId}`;
  let m = managers.get(key);
  if (!m) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
    const app = platform === 'desktop' ? 'Dracord masaüstü' : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Tarayıcı';
    m = new E2eeManager(
      client,
      {
        get: async (k) => {
          try {
            return localStorage.getItem(k);
          } catch {
            return null;
          }
        },
        set: async (k, v) => {
          localStorage.setItem(k, v);
        },
      },
      userId,
      { name: [app, os].filter(Boolean).join(' · '), platform },
    );
    managers.set(key, m);
  }
  return m;
}

const NOT_READABLE = '🔒 Bu mesaj bu cihazda okunamıyor — cihaz, mesaj gönderildikten sonra eklenmiş ya da anahtarı silinmiş.';

/**
 * E3 — DM ekranı için: durum, aç/kapat, şifreli gönderim, mesaj çözme, güvenlik kodu,
 * karşı tarafın yeni cihaz uyarısı.
 */
export function useE2eeDm(client: E2eeDmClient | null | undefined, manager: E2eeManager | null, channelId: string | null, meId: string | null) {
  const [info, setInfo] = useState<ChannelE2eeDto | null>(null);
  const [identReady, setIdentReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seenKey, setSeenKey] = useState(0);

  const load = useCallback(
    async (force = false) => {
      if (!manager || !channelId) return;
      try {
        if (force) manager.invalidate(channelId);
        setInfo(await manager.channel(channelId, force));
      } catch {
        setInfo(null);
      }
    },
    [manager, channelId],
  );

  useEffect(() => {
    setInfo(null);
    setError(null);
    if (!manager || !channelId) return;
    void manager
      .ensureIdentity()
      .then(() => setIdentReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : 'Şifreleme anahtarı oluşturulamadı'));
    void load(true);
  }, [manager, channelId, load]);

  useEffect(() => {
    if (!client || !channelId) return;
    return client.onDmE2eeUpdate((p) => {
      if (p.channelId === channelId) void load(true);
    });
  }, [client, channelId, load]);

  const enabled = Boolean(info?.enabled);

  const setEnabled = useCallback(
    async (v: boolean) => {
      if (!client || !channelId) return;
      setBusy(true);
      setError(null);
      try {
        if (v) await manager?.ensureIdentity();
        const next = await client.setChannelE2ee(channelId, v);
        manager?.invalidate(channelId);
        setInfo(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Değiştirilemedi');
      } finally {
        setBusy(false);
      }
    },
    [client, channelId, manager],
  );

  const send = useCallback(
    async (text: string, opts?: { replyToId?: string; threadRootId?: string }) => {
      if (!client || !manager || !channelId) throw new Error('Hazır değil');
      const payload = await manager.encrypt(channelId, text);
      return client.sendEncryptedMessage(channelId, payload, opts);
    },
    [client, manager, channelId],
  );

  /** Şifreli mesajları çözülmüş içerikle değiştir */
  const transform = useCallback(
    (messages: MessageDto[]): MessageDto[] => {
      if (!manager) return messages;
      return messages.map((m) => {
        if (!m.e2ee) return m;
        if (!identReady) return { ...m, content: '🔒 Çözülüyor…' };
        const r = manager.decrypt(m.id, m.e2ee, m.author.id, info);
        if (!r.ok) return { ...m, content: r.reason === 'no_key' ? NOT_READABLE : '🔒 Mesaj çözülemedi (bozuk ya da değiştirilmiş).' };
        return { ...m, content: r.verified ? r.text : `⚠️ Gönderen cihaz doğrulanamadı · ${r.text}` };
      });
    },
    [manager, identReady, info],
  );

  // Karşı tarafın cihaz kümesi değişti mi (güvenlik kodu da değişir)
  const otherDeviceIds = useMemo(
    () =>
      (info?.members ?? [])
        .filter((m) => m.userId !== meId)
        .flatMap((m) => m.devices.map((d) => d.id))
        .sort()
        .join(','),
    [info, meId],
  );
  const seenStorageKey = channelId ? `dracord:e2ee:seen:${channelId}` : '';
  const devicesChanged = useMemo(() => {
    if (!enabled || !seenStorageKey || !otherDeviceIds) return false;
    void seenKey;
    try {
      const prev = localStorage.getItem(seenStorageKey);
      if (prev === null) {
        localStorage.setItem(seenStorageKey, otherDeviceIds);
        return false;
      }
      return prev !== otherDeviceIds;
    } catch {
      return false;
    }
  }, [enabled, seenStorageKey, otherDeviceIds, seenKey]);
  const acknowledgeDevices = useCallback(() => {
    try {
      if (seenStorageKey) localStorage.setItem(seenStorageKey, otherDeviceIds);
    } catch {
      /* ignore */
    }
    setSeenKey((n) => n + 1);
  }, [seenStorageKey, otherDeviceIds]);

  const safetyNumber = useMemo(() => (info && manager ? manager.safetyNumber(info) : null), [info, manager]);

  return { info, enabled, busy, error, setEnabled, send, transform, safetyNumber, devicesChanged, acknowledgeDevices, ready: identReady };
}

export type E2eeDmController = ReturnType<typeof useE2eeDm>;
