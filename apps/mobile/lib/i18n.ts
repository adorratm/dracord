/** Mobil ayarlar / ortak etiketler — web i18n ile uyumlu anahtarlar */

type Dict = Record<string, string>;

const TR: Dict = {
  'nav.account': 'Hesap',
  'nav.accountInfo': 'Hesap Bilgileri',
  'nav.profile': 'Profil',
  'nav.password': 'Şifre',
  'nav.accountStatus': 'Hesap Durumu',
  'nav.privacy': 'Gizlilik',
  'nav.messaging': 'Mesajlaşma',
  'nav.bookmarks': 'Yer İmleri',
  'nav.notifications': 'Bildirimler',
  'nav.billing': 'Faturalandırma',
  'nav.nitro': 'Nitro',
  'nav.boost': 'Sunucu Takviyesi',
  'nav.subscriptions': 'Abonelikler',
  'nav.gifts': 'Hediyeler',
  'nav.experience': 'Deneyim',
  'nav.voice': 'Ses',
  'nav.appearance': 'Görünüm',
  'nav.accessibility': 'Erişilebilirlik',
  'nav.system': 'Sistem',
  'nav.language': 'Dil',
  'nav.developer': 'Geliştirici',
  'nav.advanced': 'Gelişmiş',
  'nav.privacyPolicy': 'Gizlilik Politikası',
  'nav.terms': 'Kullanım Şartları',
  'nav.kvkk': 'KVKK',
  'nav.cookies': 'Çerezler',
  'lang.title': 'Dil ve Zaman',
  'lang.locale': 'Arayüz dili',
  'lang.localeDesc': 'Ayarlar menüsü ve ortak etiketler bu dile uyar.',
  'lang.hour24': '24 saat formatı',
  'lang.note': 'Ayarlar ve ortak metinler çevrilir; sohbet içeriği olduğu gibi kalır.',
  'lang.saved': 'Dil kaydedildi',
};

const EN: Dict = {
  'nav.account': 'Account',
  'nav.accountInfo': 'My Account',
  'nav.profile': 'Profile',
  'nav.password': 'Password',
  'nav.accountStatus': 'Account Status',
  'nav.privacy': 'Privacy',
  'nav.messaging': 'Messaging',
  'nav.bookmarks': 'Bookmarks',
  'nav.notifications': 'Notifications',
  'nav.billing': 'Billing',
  'nav.nitro': 'Nitro',
  'nav.boost': 'Server Boost',
  'nav.subscriptions': 'Subscriptions',
  'nav.gifts': 'Gifts',
  'nav.experience': 'App Settings',
  'nav.voice': 'Voice',
  'nav.appearance': 'Appearance',
  'nav.accessibility': 'Accessibility',
  'nav.system': 'System',
  'nav.language': 'Language',
  'nav.developer': 'Developer',
  'nav.advanced': 'Advanced',
  'nav.privacyPolicy': 'Privacy Policy',
  'nav.terms': 'Terms of Service',
  'nav.kvkk': 'KVKK',
  'nav.cookies': 'Cookies',
  'lang.title': 'Language & Time',
  'lang.locale': 'UI language',
  'lang.localeDesc': 'Settings navigation and shared labels follow this language.',
  'lang.hour24': '24-hour clock',
  'lang.note': 'Settings and shared strings are translated; chat content stays as written.',
  'lang.saved': 'Language saved',
};

const TABLES: Record<'tr' | 'en', Dict> = { tr: TR, en: EN };

export type AppLocale = 'tr' | 'en';

let locale: AppLocale = 'tr';
const listeners = new Set<() => void>();

export function getAppLocale(): AppLocale {
  return locale;
}

export function setAppLocale(next: AppLocale) {
  if (locale === next) return;
  locale = next;
  for (const l of listeners) l();
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function t(key: string, loc: AppLocale = locale): string {
  return TABLES[loc][key] ?? TABLES.tr[key] ?? key;
}
