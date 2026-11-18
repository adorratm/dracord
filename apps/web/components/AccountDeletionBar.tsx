'use client';

import { AccountDeletionBanner } from '@dracord/ui';
import { useAuth } from '@/components/AuthProvider';

/** E5 — bekleyen hesap silme uyarısı (her sayfada, iptal düğmesiyle) */
export function AccountDeletionBar() {
  const { user, client, refreshUser } = useAuth();
  return <AccountDeletionBanner user={user} client={client} onCancelled={() => void refreshUser()} />;
}
