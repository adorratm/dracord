'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { SettingsLayout } from '@/components/SettingsLayout';

export default function SettingsRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SettingsLayout>{children}</SettingsLayout>
    </RequireAuth>
  );
}
