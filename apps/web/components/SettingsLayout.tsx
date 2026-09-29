'use client';

import { SettingsShell, type SettingsNavSection } from '@dracord/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';

type NavDef = {
  id: string;
  title?: string;
  items: Array<{
    id: string;
    label: string;
    icon?: string;
    href?: string;
    variant?: 'default' | 'danger';
    action?: 'logout';
  }>;
};

const NAV: NavDef[] = [
  {
    id: 'account',
    title: 'Hesap',
    items: [
      { id: 'account', label: 'Hesap Bilgileri', icon: 'person', href: '/settings/account' },
      { id: 'profile', label: 'Profil', icon: 'badge', href: '/settings/profile' },
      { id: 'password', label: 'Şifre ve Güvenlik', icon: 'lock', href: '/settings/password' },
      {
        id: 'account-status',
        label: 'Hesap Durumu',
        icon: 'manage_accounts',
        href: '/settings/account-status',
      },
      { id: 'family', label: 'Aile Merkezi', icon: 'family_restroom', href: '/settings/family' },
      { id: 'privacy', label: 'Veri ve Gizlilik', icon: 'shield', href: '/settings/privacy' },
      { id: 'messaging', label: 'Mesajlaşma İzinleri', icon: 'forum', href: '/settings/messaging' },
      {
        id: 'notifications',
        label: 'Bildirimler',
        icon: 'notifications',
        href: '/settings/notifications',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Faturalandırma',
    items: [
      { id: 'nitro', label: 'Nitro', icon: 'workspace_premium', href: '/settings/nitro' },
      { id: 'boost', label: 'Sunucu Takviyesi', icon: 'rocket_launch', href: '/settings/boost' },
      {
        id: 'subscriptions',
        label: 'Abonelikler',
        icon: 'card_membership',
        href: '/settings/subscriptions',
      },
      { id: 'gifts', label: 'Hediye Envanteri', icon: 'card_giftcard', href: '/settings/gifts' },
      { id: 'billing', label: 'Faturalandırma', icon: 'payments', href: '/settings/billing' },
    ],
  },
  {
    id: 'experience',
    title: 'Deneyimler',
    items: [
      { id: 'voice', label: 'Ses ve Görüntü', icon: 'mic', href: '/settings/voice' },
      { id: 'appearance', label: 'Görünüm', icon: 'palette', href: '/settings/appearance' },
      {
        id: 'accessibility',
        label: 'Erişilebilirlik',
        icon: 'accessibility_new',
        href: '/settings/accessibility',
      },
      { id: 'system', label: 'Sistem', icon: 'dns', href: '/settings/system' },
      { id: 'language', label: 'Dil ve Zaman', icon: 'language', href: '/settings/language' },
    ],
  },
  {
    id: 'apps',
    title: 'Oyunlar ve Uygulamalar',
    items: [
      {
        id: 'activity-privacy',
        label: 'Etkinlik Gizliliği',
        icon: 'sports_esports',
        href: '/settings/activity-privacy',
      },
      { id: 'connections', label: 'Bağlı Uygulamalar', icon: 'link', href: '/settings/connections' },
    ],
  },
  {
    id: 'developer',
    title: 'Geliştirici',
    items: [{ id: 'developer', label: 'Gelişmiş', icon: 'code', href: '/settings/developer' }],
  },
  {
    id: 'other',
    items: [
      { id: 'logout', label: 'Çıkış Yap', icon: 'logout', variant: 'danger', action: 'logout' },
      {
        id: 'privacy-policy',
        label: 'Gizlilik Politikası',
        icon: 'policy',
        href: '/settings/privacy-policy',
      },
      { id: 'terms', label: 'Hizmet Koşulları', icon: 'gavel', href: '/settings/terms' },
    ],
  },
];

export function SettingsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push('/channels/@me');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const sections: SettingsNavSection[] = NAV.map((section) => ({
    id: section.id,
    title: section.title,
    items: section.items.map((item) => {
      const href = item.href;
      const active = href ? pathname === href || pathname.startsWith(`${href}/`) : false;
      return {
        id: item.id,
        label: item.label,
        icon: item.icon,
        variant: item.variant,
        active,
        onClick: () => {
          if (item.action === 'logout') {
            logout();
            router.replace('/');
            return;
          }
          if (href) router.push(href);
        },
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
