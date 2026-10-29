'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Draco } from '@/components/Draco';

function AuthorizeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { ready, user, client } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appName, setAppName] = useState<string | null>(null);

  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const state = params.get('state') ?? undefined;
  const responseType = params.get('response_type') ?? 'code';

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const ret = `/oauth/authorize?${params.toString()}`;
      router.replace(`/login?returnUrl=${encodeURIComponent(ret)}`);
      return;
    }
    if (clientId) setAppName(clientId);
  }, [ready, user, clientId, params, router]);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await client.oauthAuthorize({
        clientId,
        redirectUri,
        responseType,
        state,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      window.location.href = res.redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onay başarısız');
    } finally {
      setBusy(false);
    }
  };

  const deny = () => {
    try {
      const url = new URL(redirectUri);
      url.searchParams.set('error', 'access_denied');
      if (state) url.searchParams.set('state', state);
      window.location.href = url.toString();
    } catch {
      router.push('/channels/@me');
    }
  };

  if (!ready || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface">
        <Draco size={96} mood="float" glow />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface px-4">
      <div className="w-full max-w-md rounded-2xl border border-surface-container-highest bg-surface-container-low p-6 space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Draco size={72} mood="wave" glow />
          <h1 className="font-headline-lg">Dracord ile devam et</h1>
          <p className="font-body-sm text-on-surface-variant">
            <span className="font-mono text-[12px]">{appName}</span> hesabına
            erişim istiyor.
          </p>
        </div>
        {error && <p className="font-body-sm text-error text-center">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !clientId || !redirectUri}
            onClick={() => void approve()}
            className="flex-1 h-10 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50"
          >
            İzin ver
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={deny}
            className="flex-1 h-10 rounded-lg bg-surface-container-high font-label-md"
          >
            Reddet
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <Draco size={96} mood="float" glow />
        </div>
      }
    >
      <AuthorizeInner />
    </Suspense>
  );
}
