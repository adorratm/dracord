import type { GuildFaqEntry } from '@dracord/types';

/** Draco'nun Dracord hakkında bildikleri (kural tabanlı; model yok) */
export const DRACO_KB: GuildFaqEntry[] = [
  {
    id: 'kb-screen',
    question: 'Ekran nasıl paylaşılır?',
    keywords: ['ekran', 'paylaş', 'yayın', 'stream', 'görüntü'],
    answer: 'Bir ses kanalına katıl, alttaki kontrol çubuğunda **ekran paylaş** düğmesine bas ve ekranı ya da pencereyi seç. Kaliteyi ve FPS\'i aynı menüden ayarlayabilirsin.',
  },
  {
    id: 'kb-remote',
    question: 'Uzak kontrol nasıl yapılır?',
    keywords: ['uzak', 'kontrol', 'remote', 'fare', 'bilgisayar'],
    answer: 'Biri ekranını paylaşırken paylaşımın üzerinde **Kontrol iste**\'ye bas; paylaşan kabul edince fare ve klavyeyi kullanırsın. Paylaşan **Esc\'yi basılı tutarak**, **Ctrl+Alt+Esc** ya da masaüstünde **Ctrl+Shift+F12** ile kontrolü anında geri alır. Mobilden de kontrol edebilirsin (dokun = tık, uzun bas = sağ tık).',
  },
  {
    id: 'kb-clip',
    question: 'Klip nasıl kaydedilir?',
    keywords: ['klip', 'kayıt', 'kaydet', 'video', 'replay'],
    answer: 'Masaüstü uygulamada, ekran paylaşımı varken kontrol çubuğundaki **Klip**\'e bas; sonra **Klibi kaydet** ya da **Ctrl+Shift+K** son 30–60 saniyeyi `Videolar/Dracord Klipleri` klasörüne kaydeder.',
  },
  {
    id: 'kb-draw',
    question: 'Ekran paylaşımına nasıl çizilir?',
    keywords: ['çiz', 'kalem', 'işaret', 'lazer', 'çizim'],
    answer: 'Paylaşımın sol altındaki **kalem** simgesine bas, renk seç ve çiz. Çizgiler herkeste görünür, birkaç saniye sonra kaybolur.',
  },
  {
    id: 'kb-captions',
    question: 'Canlı altyazı nasıl açılır?',
    keywords: ['altyazı', 'caption', 'yazıya', 'duyma'],
    answer: 'Ses kontrol çubuğunda **Altyazı** → **Altyazıları göster**. Kendi konuşmanın altyazılanması için **Konuşmamı altyazıla**: ses senin cihazında metne çevrilir, yalnız metin kanaldakilere gider.',
  },
  {
    id: 'kb-translate',
    question: 'Mesaj nasıl çevrilir?',
    keywords: ['çevir', 'çeviri', 'translate', 'dil', 'ingilizce'],
    answer: 'Mesajın menüsünden **Çevir**. Çeviri mümkünse cihazında yapılır (ilk seferde dil paketi iner); değilse tarayıcıda Google Çeviri açılır.',
  },
  {
    id: 'kb-levels',
    question: 'Seviye ve XP nasıl kazanılır?',
    keywords: ['seviye', 'xp', 'level', 'puan', 'rütbe'],
    answer: 'Mesaj yazarak (dakikada bir sayılır) ve seste vakit geçirerek XP kazanırsın. Sunucu menüsünden **Seviyeler ve görevler**\'i aç; seviyeni `/seviye` ile de görebilirsin.',
  },
  {
    id: 'kb-challenges',
    question: 'Haftalık görevler ve sezon nedir?',
    keywords: ['görev', 'haftalık', 'sezon', 'ödül', 'meydan'],
    answer: 'Her hafta 3 görev gelir (mesaj, ses, XP). Tamamlayınca **Ödülü al** ile bonus XP kazanırsın. Sezon bir takvim ayıdır; skor tablosu **Seviyeler ve görevler** penceresinde.',
  },
  {
    id: 'kb-tournament',
    question: 'Turnuva nasıl yapılır?',
    keywords: ['turnuva', 'braket', 'eleme', 'tavla', 'bilardo', 'maç'],
    answer: 'Sunucu menüsü → **Turnuvalar**. Yönetici turnuvayı açar, üyeler katılır, **Başlat** ile eşleşmeler kurulur. Maçtan sonra iki oyuncu sonucu bildirir; anlaşmazlıkta düzenleyici karar verir.',
  },
  {
    id: 'kb-soundboard',
    question: 'Soundboard nasıl kullanılır?',
    keywords: ['soundboard', 'ses efekti', 'efekt', 'sesler'],
    answer: 'Ses kanalındayken kontrol çubuğundaki **♪** ile sunucunun seslerini çal. Yöneticiler web/masaüstünden dosya, mobilden mikrofonla (≤5 sn) ses ekleyebilir.',
  },
  {
    id: 'kb-voice-msg',
    question: 'Sesli mesaj nasıl gönderilir?',
    keywords: ['sesli', 'mesaj', 'kayıt', 'mikrofon', 'voice'],
    answer: 'Mesaj kutusunun yanındaki **mikrofon** düğmesine bas, konuş, gönder. En fazla 5 dakika.',
  },
  {
    id: 'kb-schedule',
    question: 'Mesaj nasıl zamanlanır?',
    keywords: ['zamanla', 'sonra', 'ileri', 'planla', 'saat'],
    answer: 'Mesaj kutusundaki **saat** simgesiyle tarih ve saat seç; mesaj o zaman gönderilir. Bekleyenleri kanalın üstündeki çubukta görürsün.',
  },
  {
    id: 'kb-catchup',
    question: 'Kaçırdığım mesajları nasıl özetlerim?',
    keywords: ['kaçırdım', 'özet', 'okunmamış', 'catchup'],
    answer: 'Kanalda **Ne kaçırdım?** düğmesi, son okuduğundan beri yazılanları özetler (cihazında, mümkünse).',
  },
  {
    id: 'kb-games',
    question: 'Oyunlar nasıl oynanır?',
    keywords: ['oyun', 'oyna', 'etkinlik', 'okey', 'game'],
    answer: 'Ses kanalındayken kontrol çubuğundaki **Oyunlar**\'dan bir oyun başlat ya da başlamış oturuma katıl. Geliştiriciysen kendi oyununu Ayarlar → Geliştirici → Oyunlarım\'dan ekleyebilirsin.',
  },
  {
    id: 'kb-vanity',
    question: 'Sunucuya özel adres nasıl alınır?',
    keywords: ['adres', 'vanity', 'davet', 'link', 'tanıtım'],
    answer: 'Sunucu ayarları → **Tanıtım sayfası, özel adres ve rozet**. `dracord.com.tr/s/<adres>` tanıtım sayfası, `/invite/<adres>` süresiz davettir.',
  },
  {
    id: 'kb-badge',
    question: 'Profilime sunucu rozeti nasıl eklerim?',
    keywords: ['rozet', 'badge', 'profil', 'etiket', 'vitrin'],
    answer: 'Ayarlar → Profil → **Profil rozeti**\'nden üyesi olduğun ve rozeti olan bir sunucuyu seç.',
  },
  {
    id: 'kb-stats',
    question: 'Sunucu istatistikleri nerede?',
    keywords: ['istatistik', 'aktiflik', 'büyüme', 'analiz', 'stats'],
    answer: 'Sunucu ayarları → **İstatistikler** (yalnız yöneticiler): mesaj, aktif üye, ses süresi, en aktif kanallar ve saatler.',
  },
  {
    id: 'kb-automod',
    question: 'Otomatik moderasyon nasıl açılır?',
    keywords: ['moderasyon', 'spam', 'küfür', 'yasak', 'automod', 'filtre'],
    answer: 'Sunucu ayarları → **Otomatik moderasyon**: yasaklı kelimeler, spam sınırları, tekrarlayan ihlalde otomatik susturma ve muafiyetler.',
  },
  {
    id: 'kb-overlay',
    question: 'Oyun içi overlay nasıl açılır?',
    keywords: ['overlay', 'oyun içi', 'hud', 'konuşanlar'],
    answer: 'Masaüstü uygulamada **Ctrl+Shift+`** ile overlay açılır. Konuşanlar HUD\'ı ve konumu Ayarlar → Overlay\'den ayarlanır. En iyi sonuç için oyunu çerçevesiz pencerede çalıştır.',
  },
  {
    id: 'kb-download',
    question: 'Dracord uygulaması nereden indirilir?',
    keywords: ['indir', 'uygulama', 'masaüstü', 'mobil', 'android', 'windows'],
    answer: 'dracord.com.tr/download — Windows, macOS, Linux, Android ve iOS.',
  },
];
