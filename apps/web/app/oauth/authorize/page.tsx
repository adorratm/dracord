'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Draco } from '@/components/Draco';

const SCOPE_LABELS: Record<string, string> = {
  identify: 'Kullanıcı adın ve avatarın',
  email: 'E-posta adresin',
  guilds: 'Üye olduğun sunucuların listesi',
  connections: 'Bağlı hesapların',
};

function AuthorizeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { ready, user, client } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appName, setAppName] = useState<string | null>(null);
  const [appDescription, setAppDescription] = useState('');
  const [availableScopes, setAvailableScopes] = useState<string[]>(['identify']);
  const [selected, setSelected] = useState<Record<string, boolean>>({
    identify: true,
  });

  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const state = params.get('state') ?? undefined;
  const responseType = params.get('response_type') ?? 'code';
  const requestedScope = params.get('scope') ?? '';

  const requestedList = useMemo(
    () =>
      requestedScope
        .split(/[\s,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [requestedScope],
  );

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const ret = `/oauth/authorize?${params.toString()}`;
      router.replace(`/login?returnUrl=${encodeURIComponent(ret)}`);
      return;
    }
    if (!clientId) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await client.getOauthApplication(clientId);
        if (cancelled) return;
        setAppName(data.name ?? clientId);
        setAppDescription(data.description ?? '');
        const scopes =
          data.scopes?.length ? data.scopes : ['identify', 'email', 'guilds'];
        setAvailableScopes(scopes);
        const next: Record<string, boolean> = {};
        for (const s of scopes) {
          next[s] =
            s === 'identify' ||
            requestedList.length === 0 ||
            requestedList.includes(s);
        }
        next.identify = true;
        setSelected(next);
      } catch {
        if (!cancelled) setAppName(clientId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, clientId, params, router, client, requestedList]);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const scope = availableScopes.filter((s) => selected[s]);
      if (!scope.includes('identify')) scope.unshift('identify');
      const res = await client.oauthAuthorize({
        clientId,
        redirectUri,
        responseType,
        state,
        scope,
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
            <span className="font-medium text-on-surface">{appName}</span>{' '}
            hesabına erişim istiyor.
          </p>
          {appDescription ? (
            <p className="font-body-sm text-outline">{appDescription}</p>
          ) : null}
        </div>
        <div className="rounded-xl bg-surface-container-high/60 p-3 space-y-2">
          <p className="font-label-sm text-on-surface-variant">İzinler</p>
          {availableScopes.map((s) => (
            <label
              key={s}
              className="flex items-start gap-2 font-body-sm cursor-pointer"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(selected[s])}
                disabled={s === 'identify'}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [s]: e.target.checked }))
                }
              />
              <span>
                <span className="font-mono text-[11px] text-primary-container">
                  {s}
                </span>
                <br />
                {SCOPE_LABELS[s] ?? s}
              </span>
            </label>
          ))}
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
