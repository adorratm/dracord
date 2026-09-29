'use client';

import { LoginScreen } from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getDracordClient } from '@/lib/client';
import { hasSession } from '@/lib/storage';

export default function LoginPage() {
  const router = useRouter();
  const { ready, user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && (user || hasSession())) {
      router.replace('/channels/@me');
    }
  }, [ready, user, router]);

  const onGoogleLogin = () => {
    setError(null);
    window.location.href = getDracordClient().getGoogleLoginUrl();
  };

  return (
    <LoginScreen
      errorMessage={error ?? undefined}
      onGoogleLogin={onGoogleLogin}
    />
  );
}
