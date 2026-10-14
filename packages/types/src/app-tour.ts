/** Ortak uygulama turu — web / desktop / mobile */

/** v2: genişletilmiş tur — eski tamamlanma bayraklarını geçersiz kılar */
export const APP_TOUR_STORAGE_KEY = 'dracord:app-tour-v2';
/** Eski anahtarlar (temizle) */
export const APP_TOUR_STORAGE_KEY_LEGACY = 'dracord:app-tour-v1';
export const APP_TOUR_STORAGE_KEY_LEGACY_DESKTOP = 'dracord.appTour.v1';

export type AppTourMood = 'happy' | 'wave' | 'peek' | 'float' | 'idle' | 'confused';

export type AppTourStep = {
  id: string;
  title: string;
  body: string;
  /** DOM: [data-tour="…"] — mobilde yok sayılır */
  target?: string;
  mood?: AppTourMood;
};

/**
 * Kapsamlı tur adımları.
 * target değerleri data-tour özniteliği ile eşleşir.
 */
export const APP_TOUR_STEPS: AppTourStep[] = [
  {
    id: 'welcome',
    title: 'Dracord’a hoş geldin!',
    body: 'Draco seni arayüzde gezdirecek: sunucular, sohbet, ses, keşfet, bildirimler ve ayarlar. İstediğin an Atla diyebilirsin; turu Ayarlar’dan yeniden başlatabilirsin.',
    mood: 'wave',
  },
  {
    id: 'servers',
    title: 'Sunucu çubuğu',
    body: 'Soldaki simgeler katıldığın sunucular. Sürükleyerek sıralayabilir, sağ tıklayla favori / ayarlar / davet gibi işlemlere ulaşabilirsin. Artı (+) ile yeni sunucu oluşturursun.',
    target: 'servers',
    mood: 'peek',
  },
  {
    id: 'discover',
    title: 'Keşfet ve uygulamalar',
    body: 'Pusula (Keşfet) ile herkese açık sunucuları ve kürate uygulama dizinini görürsün. Kategoriye göre süz, sunucuya katıl veya oyun / Watch Party gibi uygulamaları dene.',
    target: 'discover',
    mood: 'happy',
  },
  {
    id: 'channels',
    title: 'Kanal listesi',
    body: 'Sunucu seçince solda metin, ses, oyun ve Watch Party kanalları çıkar. Kanal ayarları, kategoriler ve ses odasındaki üyeler burada görünür. Altta mikrofon / kulaklık kontrollerin var.',
    target: 'channels',
    mood: 'idle',
  },
  {
    id: 'nav',
    title: 'Üst gezinme',
    body: 'Üst çubuktan Sunucular, Direkt mesajlar, Ses ve Ayarlar arasında geçiş yaparsın. Ses kısayolu seni bağlı olduğun ses kanalına götürür.',
    target: 'nav',
    mood: 'peek',
  },
  {
    id: 'search',
    title: 'Arama',
    body: 'Büyüteç veya Ctrl+K ile hızlı arama açılır. Mesaj, kanal, kullanıcı ve sunucu sonuçlarına dönüşürsün. Kanal içi arama da sohbet başlığından yapılabilir.',
    target: 'search',
    mood: 'float',
  },
  {
    id: 'notifications',
    title: 'Bildirimler',
    body: 'Zil: bahsetmeler, cevaplar, arkadaş istekleri ve sistem uyarıları. Tıklayınca panele düşer; Ayarlar → Bildirimler’den hangi olayların geleceğini seçebilirsin.',
    target: 'notifications',
    mood: 'happy',
  },
  {
    id: 'chat',
    title: 'Sohbet alanı',
    body: 'Mesaj yaz, dosya / sticker / GIF ekle, anket oluştur. @ile bahset, #ile kanal işaretle, mesaja sağ tıkla: yanıt, pin, tepki, thread. Az mesajlı kanallarda liste alta yaslanır.',
    target: 'chat',
    mood: 'float',
  },
  {
    id: 'voice',
    title: 'Ses ve görüntü',
    body: 'Ses kanalına girince mikrofon, kulaklık, kamera ve ekran paylaşımı açılır. Katılımcı kutularında kim konuşuyor görünür; gürültü engelleme ve ses cihazlarını alt panelden veya Ayarlar → Ses’ten yönetirsin.',
    target: 'voice',
    mood: 'peek',
  },
  {
    id: 'members',
    title: 'Üye listesi',
    body: 'Sağdaki listede çevrimiçi / çevrimdışı üyeler ve rol rozetleri durur. Bir üyeye sağ tıklayarak profil, DM, sustur veya (yetkin varsa) yönetici işlemlerine ulaşırsın.',
    target: 'members',
    mood: 'idle',
  },
  {
    id: 'dms',
    title: 'Direkt mesajlar',
    body: 'Üst menüdeki Direkt mesajlar veya Ana sayfa ile arkadaşlarına yazarsın. Sesli / görüntülü DM araması da buradan başlar. Arkadaş ekle ve çevrimiçi durumu Friends hub’da yönetilir.',
    target: 'dms',
    mood: 'wave',
  },
  {
    id: 'settings',
    title: 'Ayarlar ve profil',
    body: 'Profil (avatar, banner, bio, sosyal linkler), gizlilik, görünüm, Nitro / takviye ve masaüstü sistem tercihleri burada. Bu turu yeniden görmek için Hesap → Uygulama turunu başlat.',
    target: 'settings',
    mood: 'happy',
  },
  {
    id: 'finish',
    title: 'Hazırsın!',
    body: 'İpucu: ses kanalında ekran paylaş, oyun kanalında bilardo / blackjack / okey aç, Watch Party ile birlikte izle. Takıldığın yerde Ayarlar’dan turu tekrar çalıştırabilirsin. İyi eğlenceler!',
    mood: 'wave',
  },
];

export function appTourTargetSelector(target: string): string {
  return `[data-tour="${target}"]`;
}

export function parseAppTourCompleted(
  raw: string | null | undefined,
  userId?: string | null,
): boolean {
  if (!raw) return false;
  if (raw === 'done') return true;
  try {
    const parsed = JSON.parse(raw) as { done?: boolean; userId?: string };
    if (!parsed.done) return false;
    if (userId && parsed.userId && parsed.userId !== userId) return false;
    return true;
  } catch {
    return false;
  }
}

export function serializeAppTourCompleted(userId?: string | null): string {
  return JSON.stringify({ done: true, userId: userId ?? null, at: Date.now() });
}

export function hasCompletedAppTour(userId?: string | null): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(APP_TOUR_STORAGE_KEY);
    return parseAppTourCompleted(raw, userId);
  } catch {
    return false;
  }
}

export function markAppTourCompleted(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const value = serializeAppTourCompleted(userId);
    localStorage.setItem(APP_TOUR_STORAGE_KEY, value);
    localStorage.removeItem(APP_TOUR_STORAGE_KEY_LEGACY);
    localStorage.removeItem(APP_TOUR_STORAGE_KEY_LEGACY_DESKTOP);
  } catch {
    /* ignore */
  }
}

export function resetAppTour(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(APP_TOUR_STORAGE_KEY);
    localStorage.removeItem(APP_TOUR_STORAGE_KEY_LEGACY);
    localStorage.removeItem(APP_TOUR_STORAGE_KEY_LEGACY_DESKTOP);
  } catch {
    /* ignore */
  }
}
