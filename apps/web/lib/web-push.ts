/** Web Push aboneliği (VAPID). Sunucuda VAPID_* yoksa no-op. */

type PushClient = {
  getPushVapidPublicKey: () => Promise<{ publicKey: string | null; enabled: boolean }>;
  subscribePush: (data: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  }) => Promise<{ ok: true }>;
  unsubscribePush: (endpoint: string) => Promise<{ ok: true }>;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerPushWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function subscribeWebPush(
  client: PushClient,
): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false, reason: 'ssr' };
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
    return { ok: false, reason: 'desteklenmiyor' };
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'izin yok' };

  const meta = await client.getPushVapidPublicKey();
  if (!meta.enabled || !meta.publicKey) {
    return { ok: false, reason: 'sunucu VAPID yapılandırılmamış' };
  }

  const reg = await registerPushWorker();
  if (!reg) return { ok: false, reason: 'service worker kaydı başarısız' };

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(meta.publicKey) as BufferSource,
    }));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: 'abonelik eksik' };
  }

  await client.subscribePush({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent,
  });
  return { ok: true };
}

export async function unsubscribeWebPush(client: PushClient): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => undefined);
  await client.unsubscribePush(endpoint).catch(() => undefined);
}
