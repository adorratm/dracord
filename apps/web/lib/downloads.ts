/** Mağaza / Release URL’leri — NEXT_PUBLIC_* (build-time) veya aşağıdaki varsayılanlar */

export type DownloadPlatformId = 'play' | 'ios' | 'windows' | 'linux' | 'macos';

export type DownloadItem = {
  id: DownloadPlatformId;
  label: string;
  icon: string;
  href: string;
  /** İndirmeden önce bilgilendirme modalı (imzasız Windows) */
  warnBeforeDownload?: 'windows-unsigned';
};

/** Boş string de fallback’e düşsün (Docker ARG default = "") */
function downloadHref(envValue: string | undefined, fallback = ''): string {
  const v = (envValue ?? '').trim();
  return v || fallback;
}

const RELEASE = 'https://github.com/adorratm/dracord/releases/download/desktop-v0.1.0';

export const DOWNLOADS: DownloadItem[] = [
  {
    id: 'play',
    label: 'Google Play',
    icon: 'android',
    href: downloadHref(
      process.env.NEXT_PUBLIC_DOWNLOAD_PLAY,
      'https://play.google.com/store/apps/details?id=com.dracord.mobile',
    ),
  },
  {
    id: 'ios',
    label: 'App Store',
    icon: 'phone_iphone',
    // App Store id yokken boş bırak — «Yakında»
    href: downloadHref(process.env.NEXT_PUBLIC_DOWNLOAD_IOS),
  },
  {
    id: 'windows',
    label: 'Windows',
    icon: 'desktop_windows',
    href: downloadHref(
      process.env.NEXT_PUBLIC_DOWNLOAD_WINDOWS,
      `${RELEASE}/Dracord-Setup-0.1.0.exe`,
    ),
    warnBeforeDownload: 'windows-unsigned',
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: 'terminal',
    href: downloadHref(
      process.env.NEXT_PUBLIC_DOWNLOAD_LINUX,
      `${RELEASE}/Dracord-0.1.0-linux.AppImage`,
    ),
  },
  {
    id: 'macos',
    label: 'macOS',
    icon: 'laptop_mac',
    href: downloadHref(
      process.env.NEXT_PUBLIC_DOWNLOAD_MACOS,
      `${RELEASE}/Dracord-0.1.0-mac.dmg`,
    ),
  },
];

export const WINDOWS_UNSIGNED_STEPS = [
  'Kurulum dosyası şu an kod imzası (Authenticode) olmadan dağıtılıyor; bu yüzden Windows SmartScreen uyarısı gösterebilir.',
  'Uyarı penceresinde «Diğer bilgiler» (More info) seçeneğine tıkla.',
  'Ardından «Yine de çalıştır» (Run anyway) ile kuruluma devam et.',
  'Dosyayı yalnızca resmi siteden veya GitHub Releases sayfamızdan indir. Başka bir kaynaktan indirme.',
] as const;
