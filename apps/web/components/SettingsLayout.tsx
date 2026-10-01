'use client';

import { SettingsShell, type SettingsNavSection } from '@dracord/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useI18n } from '@/lib/i18n';
import { getSettingsReturnPath } from '@/lib/settings-return';

type NavDef = {
  id: string;
  titleKey?: string;
  items: Array<{
    id: string;
    labelKey: string;
    icon?: string;
    href?: string;
    variant?: 'default' | 'danger';
    action?: 'logout';
  }>;
};

const NAV: NavDef[] = [
  {
    id: 'account',
    titleKey: 'nav.account',
    items: [
      { id: 'account', labelKey: 'nav.accountInfo', icon: 'person', href: '/settings/account' },
      { id: 'profile', labelKey: 'nav.profile', icon: 'badge', href: '/settings/profile' },
      { id: 'password', labelKey: 'nav.password', icon: 'lock', href: '/settings/password' },
      {
        id: 'account-status',
        labelKey: 'nav.accountStatus',
        icon: 'manage_accounts',
        href: '/settings/account-status',
      },
      { id: 'privacy', labelKey: 'nav.privacy', icon: 'shield', href: '/settings/privacy' },
      { id: 'messaging', labelKey: 'nav.messaging', icon: 'forum', href: '/settings/messaging' },
      { id: 'bookmarks', labelKey: 'nav.bookmarks', icon: 'bookmark', href: '/settings/bookmarks' },
      {
        id: 'notifications',
        labelKey: 'nav.notifications',
        icon: 'notifications',
        href: '/settings/notifications',
      },
    ],
  },
  {
    id: 'experience',
    titleKey: 'nav.experience',
    items: [
      { id: 'voice', labelKey: 'nav.voice', icon: 'mic', href: '/settings/voice' },
      { id: 'appearance', labelKey: 'nav.appearance', icon: 'palette', href: '/settings/appearance' },
      {
        id: 'accessibility',
        labelKey: 'nav.accessibility',
        icon: 'accessibility_new',
        href: '/settings/accessibility',
      },
      { id: 'system', labelKey: 'nav.system', icon: 'dns', href: '/settings/system' },
      { id: 'language', labelKey: 'nav.language', icon: 'language', href: '/settings/language' },
    ],
  },
  {
    id: 'developer',
    titleKey: 'nav.developer',
    items: [{ id: 'developer', labelKey: 'nav.advanced', icon: 'code', href: '/settings/developer' }],
  },
  {
    id: 'other',
    items: [
      { id: 'logout', labelKey: 'nav.logout', icon: 'logout', variant: 'danger', action: 'logout' },
      {
        id: 'privacy-policy',
        labelKey: 'nav.privacyPolicy',
        icon: 'policy',
        href: '/settings/privacy-policy',
      },
      { id: 'terms', labelKey: 'nav.terms', icon: 'gavel', href: '/settings/terms' },
      { id: 'kvkk', labelKey: 'nav.kvkk', icon: 'verified_user', href: '/legal/kvkk' },
      { id: 'cookies', labelKey: 'nav.cookies', icon: 'cookie', href: '/legal/cookies' },
    ],
  },
];

export function SettingsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();
  const { t } = useI18n();

  const closeSettings = useCallback(() => {
    router.push(getSettingsReturnPath('/channels/@me'));
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSettings]);

  const sections: SettingsNavSection[] = useMemo(
    () =>
      NAV.map((section) => ({
        id: section.id,
        title: section.titleKey ? t(section.titleKey) : undefined,
        items: section.items.map((item) => {
          const href = item.href;
          const active = href
            ? pathname === href || pathname.startsWith(`${href}/`)
            : false;
          return {
            id: item.id,
            label: t(item.labelKey),
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
      })),
    [t, pathname, logout, router],
  );

  return (
    <SettingsShell title="Dracord" onClose={closeSettings} sections={sections}>
      {children}
    </SettingsShell>
  );
}
