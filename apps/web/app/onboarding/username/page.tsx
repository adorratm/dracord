'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Draco } from '@/components/Draco';
import { persistSession, getAccessToken, getRefreshToken } from '@/lib/storage';

function suggestFromDisplayName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 24) || 'kullanici'
  );
}

export default function UsernameOnboardingPage() {
  const { user, client, ready, setUser } = useAuth();
  const router = useRouter();
  const suggested = useMemo(
    () => suggestFromDisplayName(user?.displayName ?? user?.username ?? 'kullanici'),
    [user?.displayName, user?.username],
  );
  const [username, setUsername] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.usernameConfirmed !== false) {
      router.replace('/channels/@me');
    }
  }, [ready, user, router]);

  useEffect(() => {
    if (user && !username) {
      setUsername(suggested);
    }
  }, [user, suggested, username]);

  useEffect(() => {
    const q = username.trim();
    if (q.length < 2) {
      setAvailable(null);
      return;
    }
    const t = window.setTimeout(() => {
      setChecking(true);
      void client
        .checkUsernameAvailable(q)
        .then((r) => setAvailable(r.available))
        .catch(() => setAvailable(null))
        .finally(() => setChecking(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [username, client]);

  const submit = useCallback(
    async (value: string) => {
      setSaving(true);
      setError(null);
      try {
        const me = await client.confirmUsername(value);
        setUser(me);
        const access = getAccessToken();
        const refresh = getRefreshToken();
        if (access && refresh) persistSession(access, refresh, me);
        router.replace('/channels/@me');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kullanıcı adı kaydedilemedi');
      } finally {
        setSaving(false);
      }
    },
    [client, setUser, router],
  );

  if (!ready || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
        <p className="text-on-surface-variant">Yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest px-space-lg">
      <div className="w-full max-w-md rounded-2xl bg-surface-container-low p-space-xl space-y-space-lg">
        <div className="flex flex-col items-center text-center gap-space-sm">
          <Draco size={100} mood="happy" glow />
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Kullanıcı adını seç
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Sunucu oluşturmadan veya katılmadan önce benzersiz bir kullanıcı adı
            belirlemelisin. İstersen adından önerileni kullanabilirsin.
          </p>
        </div>

        <label className="block space-y-space-xs">
          <span className="font-label-md text-on-surface-variant">Kullanıcı adı</span>
          <div className="flex items-center gap-1 rounded-lg bg-surface-container-highest px-space-md">
            <span className="text-outline">@</span>
            <input
              className="flex-1 h-11 bg-transparent outline-none text-on-surface font-body-md"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              autoComplete="username"
              maxLength={32}
              spellCheck={false}
            />
          </div>
          <p className="font-label-sm text-on-surface-variant">
            {checking
              ? 'Kontrol ediliyor…'
              : available === true
                ? 'Kullanılabilir'
                : available === false
                  ? 'Bu ad alınmış'
                  : 'En az 2 karakter, a-z 0-9 _'}
          </p>
        </label>

        {error && <p className="font-body-sm text-error">{error}</p>}

        <div className="flex flex-col gap-space-sm">
          <button
            type="button"
            disabled={saving || available === false || username.trim().length < 2}
            onClick={() => void submit(username)}
            className="h-11 rounded-lg bg-primary-container text-on-primary-container font-headline-md disabled:opacity-40"
          >
            {saving ? 'Kaydediliyor…' : 'Devam et'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit(suggested)}
            className="h-11 rounded-lg bg-surface-container-high text-on-surface font-body-md hover:bg-surface-bright disabled:opacity-40"
          >
            Adımdan kullan: @{suggested}
          </button>
        </div>
      </div>
    </div>
  );
}
