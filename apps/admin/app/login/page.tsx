'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

function LoginInner() {
  const { user, ready, loginWithGoogle } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) {
      router.replace('/dashboard');
    }
  }, [ready, user, router]);

  useEffect(() => {
    const err = params.get('error');
    const reason = params.get('reason');
    if (!err) return;
    if (err === 'admin_denied') {
      setError(
        reason?.trim() ||
          'Bu Google hesabı admin paneline giriş yapamaz. Yalnızca yetkili e-posta kabul edilir.',
      );
      return;
    }
    setError(reason?.trim() || 'Google girişi başarısız oldu.');
  }, [params]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-dracula-comment">
        Yükleniyor…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-dracula-bg-dark px-4">
      <div className="w-full max-w-md rounded-lg border border-dracula-current bg-dracula-bg p-8 shadow-float">
        <h1 className="text-2xl font-bold text-dracula-purple">Dracord Admin</h1>
        <p className="mt-2 text-sm text-dracula-comment">
          Yalnızca yetkili Google hesabı ile giriş yapılabilir.
        </p>
        {error ? <p className="mt-4 text-sm text-dracula-red">{error}</p> : null}
        <button
          type="button"
          onClick={() => loginWithGoogle()}
          className="mt-6 w-full rounded bg-dracula-purple px-4 py-2.5 font-medium text-dracula-bg-dark transition hover:opacity-90"
        >
          Google ile giriş
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-dracula-comment">
          Yükleniyor…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
