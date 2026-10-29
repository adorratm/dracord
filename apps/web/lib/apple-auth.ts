/** AppleJS Sign in with Apple — NEXT_PUBLIC_APPLE_CLIENT_ID gerekir */

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (cfg: Record<string, unknown>) => void;
        signIn: () => Promise<{
          authorization?: { id_token?: string; code?: string };
          user?: { email?: string; name?: { firstName?: string; lastName?: string } };
        }>;
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadAppleScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.AppleID?.auth) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src =
      'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('AppleID script yüklenemedi'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function appleClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID?.trim();
  return id || null;
}

export async function signInWithApple(): Promise<{
  idToken: string;
  email?: string;
  displayName?: string;
}> {
  const clientId = appleClientId();
  if (!clientId) throw new Error('NEXT_PUBLIC_APPLE_CLIENT_ID yok');
  await loadAppleScript();
  if (!window.AppleID?.auth) throw new Error('AppleID hazır değil');
  window.AppleID.auth.init({
    clientId,
    scope: 'name email',
    redirectURI:
      process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI?.trim() ||
      `${window.location.origin}/login`,
    usePopup: true,
  });
  const res = await window.AppleID.auth.signIn();
  const idToken = res.authorization?.id_token;
  if (!idToken) throw new Error('Apple id_token alınamadı');
  const email = res.user?.email;
  const displayName = [res.user?.name?.firstName, res.user?.name?.lastName]
    .filter(Boolean)
    .join(' ');
  return { idToken, email, displayName: displayName || undefined };
}
