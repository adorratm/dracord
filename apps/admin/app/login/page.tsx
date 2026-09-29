'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const { user, ready, loginDev } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('VampireDev');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace('/dashboard');
    }
  }, [ready, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginDev(username.trim() || undefined);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  }

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
          Geliştirme ortamında dev-login ile oturum açın.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm text-dracula-fg">
            Kullanıcı adı
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded border border-dracula-current bg-dracula-bg-darker px-3 py-2 text-dracula-fg outline-none focus:border-dracula-purple"
              autoComplete="username"
            />
          </label>
          {error ? <p className="text-sm text-dracula-red">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-dracula-purple px-4 py-2 font-medium text-dracula-bg-dark transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Giriş yapılıyor…' : 'Dev giriş'}
          </button>
        </form>
      </div>
    </div>
  );
}
