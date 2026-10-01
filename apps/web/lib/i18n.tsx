'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useUserPreferences } from '@/lib/user-preferences';

type Dict = Record<string, string>;

const TR: Dict = {
  'nav.account': 'Hesap',
  'nav.accountInfo': 'Hesap Bilgileri',
  'nav.profile': 'Profil',
  'nav.password': 'Şifre ve Güvenlik',
  'nav.accountStatus': 'Hesap Durumu',
  'nav.privacy': 'Veri ve Gizlilik',
  'nav.messaging': 'Mesajlaşma İzinleri',
  'nav.bookmarks': 'Yer İmleri',
  'nav.notifications': 'Bildirimler',
  'nav.experience': 'Deneyimler',
  'nav.voice': 'Ses ve Görüntü',
  'nav.appearance': 'Görünüm',
  'nav.accessibility': 'Erişilebilirlik',
  'nav.system': 'Sistem',
  'nav.language': 'Dil ve Zaman',
  'nav.developer': 'Geliştirici',
  'nav.advanced': 'Gelişmiş',
  'nav.logout': 'Çıkış Yap',
  'nav.privacyPolicy': 'Gizlilik Politikası',
  'nav.terms': 'Hizmet Koşulları',
  'nav.kvkk': 'KVKK',
  'nav.cookies': 'Çerezler',
  'lang.title': 'Dil ve Zaman',
  'lang.desc': 'Arayüz dili ile tarih/saat biçimi.',
  'lang.locale': 'Dil',
  'lang.localeDesc': 'Ayarlar menüsü ve ortak etiketler bu dile uyar.',
  'lang.hour24': '24 saat biçimi',
  'lang.note': 'Ayarlar navigasyonu ve ortak metinler çevrilir; sohbet gövdesi kullanıcı dilinde kalır.',
  'msg.title': 'Mesajlaşma İzinleri',
  'msg.desc': 'Kimlerin sana mesaj atabileceğini ve içerik tercihlerini ayarla.',
  'msg.filter': 'Uygunsuz içerik filtresi',
  'msg.filterDesc': 'Mesajlarda kaba kelimeleri sansürle ve şüpheli medya önizlemelerini gizle.',
  'privacy.data': 'Kullanım verisi toplama',
  'privacy.dataDesc': 'İyileştirme için anonim analitik (GA). Kapalıysa yüklenmez.',
  'privacy.ads': 'Kişiselleştirilmiş deneyim',
  'privacy.adsDesc': 'Tercihlerine göre önerileri kişiselleştir (yerel).',
  'privacy.activity': 'Etkinlik durumunu paylaş',
  'privacy.activityDesc': 'Ses/oyun etkinliğini arkadaşların görebilsin.',
  'common.loading': 'Yükleniyor…',
  'common.save': 'Kaydet',
  'common.cancel': 'Vazgeç',
  'forum.sortNewest': 'En yeni',
  'forum.sortOldest': 'En eski',
  'forum.sortPinned': 'Sabitlenenler önce',
  'forum.allTags': 'Tüm etiketler',
  'forum.newPost': 'Yeni gönderi',
  'call.screen': 'Ekran paylaş',
  'call.grid': 'Görüntülü arama',
};

const EN: Dict = {
  'nav.account': 'Account',
  'nav.accountInfo': 'My Account',
  'nav.profile': 'Profile',
  'nav.password': 'Password & Security',
  'nav.accountStatus': 'Account Status',
  'nav.privacy': 'Data & Privacy',
  'nav.messaging': 'Messaging',
  'nav.bookmarks': 'Bookmarks',
  'nav.notifications': 'Notifications',
  'nav.experience': 'App Settings',
  'nav.voice': 'Voice & Video',
  'nav.appearance': 'Appearance',
  'nav.accessibility': 'Accessibility',
  'nav.system': 'System',
  'nav.language': 'Language & Time',
  'nav.developer': 'Developer',
  'nav.advanced': 'Advanced',
  'nav.logout': 'Log Out',
  'nav.privacyPolicy': 'Privacy Policy',
  'nav.terms': 'Terms of Service',
  'nav.kvkk': 'KVKK',
  'nav.cookies': 'Cookies',
  'lang.title': 'Language & Time',
  'lang.desc': 'UI language and date/time format.',
  'lang.locale': 'Language',
  'lang.localeDesc': 'Settings navigation and shared labels follow this language.',
  'lang.hour24': '24-hour clock',
  'lang.note': 'Settings nav and shared strings are translated; chat content stays as written.',
  'msg.title': 'Messaging Permissions',
  'msg.desc': 'Who can message you and content preferences.',
  'msg.filter': 'Explicit content filter',
  'msg.filterDesc': 'Censor strong language in messages and hide suspicious media previews.',
  'privacy.data': 'Usage data collection',
  'privacy.dataDesc': 'Anonymous analytics for improvements (GA). Off = not loaded.',
  'privacy.ads': 'Personalized experience',
  'privacy.adsDesc': 'Personalize suggestions from your preferences (local).',
  'privacy.activity': 'Share activity status',
  'privacy.activityDesc': 'Let friends see voice/game activity.',
  'common.loading': 'Loading…',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'forum.sortNewest': 'Newest',
  'forum.sortOldest': 'Oldest',
  'forum.sortPinned': 'Pinned first',
  'forum.allTags': 'All tags',
  'forum.newPost': 'New post',
  'call.screen': 'Share screen',
  'call.grid': 'Video call',
};

const TABLES: Record<'tr' | 'en', Dict> = { tr: TR, en: EN };

type I18nCtx = {
  locale: 'tr' | 'en';
  t: (key: string) => string;
};

const Ctx = createContext<I18nCtx>({
  locale: 'tr',
  t: (k) => TR[k] ?? k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const { prefs } = useUserPreferences();
  const locale = prefs.language.locale === 'en' ? 'en' : 'tr';
  const value = useMemo<I18nCtx>(
    () => ({
      locale,
      t: (key: string) => TABLES[locale][key] ?? TABLES.tr[key] ?? key,
    }),
    [locale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
