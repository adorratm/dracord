'use client';

import { SettingsShell, type SettingsNavSection } from '@dracord/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

const NAV: SettingsNavSection[] = [
  {
    id: 'user',
    title: 'Kullanıcı Ayarları',
    items: [
      { id: 'account', label: 'Hesabım', icon: 'person' },
      { id: 'profile', label: 'Profil', icon: 'badge' },
      { id: 'appearance', label: 'Görünüm', icon: 'palette' },
    ],
  },
  {
    id: 'app',
    title: 'Uygulama',
    items: [
      { id: 'voice', label: 'Ses ve Görüntü', icon: 'mic' },
      { id: 'notifications', label: 'Bildirimler', icon: 'notifications' },
    ],
  },
];

export function SettingsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push('/channels/@me');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const sections = NAV.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const href =
        item.id === 'account'
          ? '/settings'
          : `/settings/${item.id}`;
      return {
        ...item,
        active: pathname === href,
        onClick: () => router.push(href),
      };
    }),
  }));

  return (
    <SettingsShell
      title="Dracord Ayarları"
      sections={sections}
      onClose={() => router.push('/channels/@me')}
      className="h-screen overflow-hidden"
    >
      {children}
    </SettingsShell>
  );
}
