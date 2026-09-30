'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';

const nav = [
  { href: '/dashboard', label: 'Panel' },
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
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-dracula-bg-dark">
      <header className="border-b border-dracula-current bg-dracula-bg px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-dracula-purple">Dracord Admin</h1>
            <p className="text-sm text-dracula-comment">{user.displayName ?? user.username}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-1.5 text-sm transition ${
                    active
                      ? 'bg-dracula-current text-dracula-fg'
                      : 'text-dracula-comment hover:bg-dracula-current/60 hover:text-dracula-fg'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="rounded px-3 py-1.5 text-sm text-dracula-pink hover:bg-dracula-current/60"
            >
              Çıkış
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
