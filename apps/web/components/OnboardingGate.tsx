'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

const ALLOWED_WITHOUT_USERNAME = [
  '/',
  '/login',
  '/auth/callback',
  '/onboarding/username',
];

/** Kullanıcı adı onaylanmadan uygulama alanına girişi engeller. */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !user) return;
    if (user.usernameConfirmed !== false) return;
    const allowed = ALLOWED_WITHOUT_USERNAME.some(
      (p) => pathname === p || pathname?.startsWith(`${p}/`),
    );
    if (!allowed) {
      router.replace('/onboarding/username');
    }
  }, [ready, user, pathname, router]);

  return <>{children}</>;
}
