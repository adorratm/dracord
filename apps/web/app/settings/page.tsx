'use client';

import { presenceLabelTr } from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function SettingsAccountPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="max-w-2xl px-space-xl py-space-xl space-y-space-lg">
      <section>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-space-sm">Hesabım</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
          Profil bilgilerin ve oturum yönetimi.
        </p>
        <div className="rounded-xl bg-surface-container-low p-space-lg space-y-space-sm">
          <p className="font-headline-md text-headline-md">{user?.displayName ?? '—'}</p>
          <p className="font-body-sm text-body-sm text-outline">@{user?.username ?? '—'}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Durum: {presenceLabelTr(user?.status ?? 'OFFLINE')}
          </p>
          <button
            type="button"
            className="mt-space-sm text-primary-container font-body-sm hover:underline"
            onClick={() => router.push('/settings/profile')}
          >
            Profili düzenle
          </button>
        </div>
      </section>

      <section>
        <h3 className="font-headline-md text-headline-md mb-space-sm">Oturum</h3>
        <button
          type="button"
          onClick={handleLogout}
          className="px-space-lg py-space-sm rounded-lg bg-error-container text-on-error-container font-headline-md hover:opacity-90"
        >
          Çıkış yap
        </button>
      </section>
    </div>
  );
}
