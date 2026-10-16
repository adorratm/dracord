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

/**
 * Sürümsüz dosya adları + GitHub “latest” — .env her release’te değişmez.
 * Artifact adları apps/desktop package.json build.artifactName ile uyumlu olmalı.
 */
const LATEST =
  'https://github.com/adorratm/dracord/releases/latest/download';

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
      `${LATEST}/Dracord-Setup-Windows.exe`,
    ),
    warnBeforeDownload: 'windows-unsigned',
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: 'terminal',
    href: downloadHref(
      process.env.NEXT_PUBLIC_DOWNLOAD_LINUX,
      `${LATEST}/Dracord-linux.AppImage`,
    ),
  },
  {
    id: 'macos',
    label: 'macOS',
    icon: 'laptop_mac',
    href: downloadHref(
      process.env.NEXT_PUBLIC_DOWNLOAD_MACOS,
      `${LATEST}/Dracord-mac.dmg`,
    ),
  },
];

export const WINDOWS_UNSIGNED_STEPS = [
  'Kurulum dosyası şu an kod imzası (Authenticode) olmadan dağıtılıyor; bu yüzden Windows SmartScreen uyarısı gösterebilir.',
  'Uyarı penceresinde «Diğer bilgiler» (More info) seçeneğine tıkla.',
  'Ardından «Yine de çalıştır» (Run anyway) ile kuruluma devam et.',
  'Dosyayı yalnızca resmi siteden veya GitHub Releases sayfamızdan indir. Başka bir kaynaktan indirme.',
] as const;
