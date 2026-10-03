'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';

const nav = [
  { href: '/dashboard', label: 'Panel' },
  { href: '/search', label: 'Arama' },
  { href: '/users', label: 'Kullanıcılar' },
  { href: '/guilds', label: 'Sunucular' },
  { href: '/queues', label: 'Kuyruklar' },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, ready, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user && pathname !== '/login' && !pathname.startsWith('/auth/')) {
      router.replace('/login');
    }
  }, [ready, user, pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-dracula-comment">
        Yükleniyor…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-dracula-bg-dark px-4">
        <p className="text-dracula-comment">Oturum gerekli</p>
        <a
          href="/login"
          className="rounded bg-dracula-purple px-4 py-2 text-sm text-dracula-fg hover:opacity-90"
        >
          Giriş yap
        </a>
      </div>
    );
  }

  return (
    <div className="relative z-0 flex min-h-screen flex-col bg-dracula-bg-dark">
      <header className="relative z-20 border-b border-dracula-current bg-dracula-bg px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <a href="/dashboard" className="flex cursor-pointer items-center gap-3 hover:opacity-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <div>
              <h1 className="text-lg font-semibold text-dracula-purple">Dracord Admin</h1>
              <p className="text-sm text-dracula-comment">{user.displayName ?? user.username}</p>
            </div>
          </a>
          <nav className="relative z-20 flex flex-wrap items-center gap-2">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`cursor-pointer rounded px-3 py-1.5 text-sm transition ${
                    active
                      ? 'bg-dracula-current text-dracula-fg'
                      : 'text-dracula-comment hover:bg-dracula-current/60 hover:text-dracula-fg'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            <button
              type="button"
              onClick={() => {
                logout();
                window.location.href = '/login';
              }}
              className="cursor-pointer rounded px-3 py-1.5 text-sm text-dracula-pink hover:bg-dracula-current/60"
            >
              Çıkış
            </button>
          </nav>
        </div>
      </header>
      <main className="relative z-0 mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
