/**
 * E3 — mobil uçtan uca şifreli DM.
 * Hermes'te crypto.getRandomValues yok → tweetnacl PRNG'si expo-crypto ile beslenir.
 * Kimlik (cihaz anahtar çifti) SecureStore'da, "görülen cihazlar" AsyncStorage'da tutulur.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChannelE2eeDto, E2eePayload, MessageDto } from '@dracord/types';
import { E2eeManager, e2eeAvailable, setE2eeRandomSource, type E2eeApi } from '@dracord/sdk';

let randomReady = false;
function ensureRandom(): boolean {
  if (randomReady) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require('expo-crypto') as {
      getRandomBytes?: (n: number) => Uint8Array;
      getRandomValues?: <T extends Uint8Array>(a: T) => T;
    };
    setE2eeRandomSource((n) => {
      const out = new Uint8Array(n);
      if (Crypto.getRandomValues) {
        // getRandomValues tek seferde en fazla 65536 bayt
        for (let i = 0; i < n; i += 65536) Crypto.getRandomValues(out.subarray(i, Math.min(n, i + 65536)));
        return out;
      }
      if (!Crypto.getRandomBytes) throw new Error('rastgele kaynak yok');
      for (let i = 0; i < n; i += 1024) out.set(Crypto.getRandomBytes(Math.min(1024, n - i)), i);
      return out;
    });
    randomReady = e2eeAvailable();
  } catch {
    randomReady = false;
  }
  return randomReady;
}

export type MobileE2eeClient = E2eeApi & {
  setChannelE2ee(channelId: string, enabled: boolean): Promise<ChannelE2eeDto>;
  sendEncryptedMessage(
    channelId: string,
    payload: E2eePayload,
    opts?: { replyToId?: string; threadRootId?: string },
  ): Promise<MessageDto>;
  onDmE2eeUpdate(h: (p: { channelId: string; enabled?: boolean; by?: string; devicesChangedBy?: string }) => void): () => void;
};

/** SecureStore anahtarı yalnız [A-Za-z0-9._-] kabul eder */
const secureKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

const managers = new Map<string, E2eeManager>();

export function mobileE2eeManager(client: E2eeApi, userId: string): E2eeManager | null {
  if (!ensureRandom()) return null;
  let m = managers.get(userId);
  if (!m) {
    m = new E2eeManager(
      client,
      {
        get: (k) => SecureStore.getItemAsync(secureKey(k)).catch(() => null),
        set: (k, v) => SecureStore.setItemAsync(secureKey(k), v),
      },
      userId,
      { name: `Dracord mobil · ${Platform.OS === 'ios' ? 'iOS' : 'Android'}`, platform: 'mobile' },
    );
    managers.set(userId, m);
  }
  return m;
}

const NOT_READABLE = '🔒 Bu mesaj bu cihazda okunamıyor — cihaz, mesaj gönderildikten sonra eklenmiş ya da anahtarı silinmiş.';

export function useMobileE2eeDm(client: MobileE2eeClient | null | undefined, userId: string | null, channelId: string | null) {
  const manager = useMemo(() => (client && userId ? mobileE2eeManager(client, userId) : null), [client, userId]);
  const [info, setInfo] = useState<ChannelE2eeDto | null>(null);
  const [identReady, setIdentReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

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
    if (!channelId) return;
    if (!manager) {
      setError('Bu cihaz uçtan uca şifrelemeyi desteklemiyor (uygulamayı güncelle).');
      return;
    }
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
      if (!client || !manager || !channelId) throw new Error('Şifreleme hazır değil');
      const payload = await manager.encrypt(channelId, text);
      return client.sendEncryptedMessage(channelId, payload, opts);
    },
    [client, manager, channelId],
  );

  const transformOne = useCallback(
    (m: MessageDto): MessageDto => {
      if (!m.e2ee) return m;
      if (!manager) return { ...m, content: NOT_READABLE };
      if (!identReady) return { ...m, content: '🔒 Çözülüyor…' };
      const r = manager.decrypt(m.id, m.e2ee, m.author.id, info);
      if (!r.ok) return { ...m, content: r.reason === 'no_key' ? NOT_READABLE : '🔒 Mesaj çözülemedi (bozuk ya da değiştirilmiş).' };
      return { ...m, content: r.verified ? r.text : `⚠️ Gönderen cihaz doğrulanamadı · ${r.text}` };
    },
    [manager, identReady, info],
  );
  const transform = useCallback((list: MessageDto[]) => list.map(transformOne), [transformOne]);

  const otherDeviceIds = useMemo(
    () =>
      (info?.members ?? [])
        .filter((m) => m.userId !== userId)
        .flatMap((m) => m.devices.map((d) => d.id))
        .sort()
        .join(','),
    [info, userId],
  );
  const seenKey = channelId ? `dracord:e2ee:seen:${channelId}` : '';
  useEffect(() => {
    setSeen(undefined);
    if (!seenKey) return;
    void AsyncStorage.getItem(seenKey).then(setSeen).catch(() => setSeen(null));
  }, [seenKey]);
  useEffect(() => {
    if (seen === null && enabled && otherDeviceIds && seenKey) {
      setSeen(otherDeviceIds);
      void AsyncStorage.setItem(seenKey, otherDeviceIds).catch(() => undefined);
    }
  }, [seen, enabled, otherDeviceIds, seenKey]);
  const devicesChanged = Boolean(enabled && otherDeviceIds && typeof seen === 'string' && seen !== otherDeviceIds);
  const acknowledgeDevices = useCallback(() => {
    if (!seenKey) return;
    setSeen(otherDeviceIds);
    void AsyncStorage.setItem(seenKey, otherDeviceIds).catch(() => undefined);
  }, [seenKey, otherDeviceIds]);

  const safetyNumber = useMemo(() => (info && manager ? manager.safetyNumber(info) : null), [info, manager]);

  return {
    info,
    enabled,
    busy,
    error,
    setEnabled,
    send,
    transform,
    transformOne,
    safetyNumber,
    devicesChanged,
    acknowledgeDevices,
    ready: identReady,
    supported: Boolean(manager),
  };
}

export type MobileE2eeController = ReturnType<typeof useMobileE2eeDm>;
