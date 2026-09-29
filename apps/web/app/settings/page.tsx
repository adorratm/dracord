'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings/account');
  }, [router]);
  return (
    <div className="flex items-center justify-center py-space-xl text-outline font-body-sm">
      Yönlendiriliyor…
    </div>
  );
}
