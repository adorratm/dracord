/** Mağaza / Release URL’leri — prod env ile doldurulur */

export type DownloadPlatformId = 'play' | 'ios' | 'windows' | 'linux' | 'macos';

export type DownloadItem = {
  id: DownloadPlatformId;
  label: string;
  icon: string;
  href: string;
  /** İndirmeden önce bilgilendirme modalı (imzasız Windows) */
  warnBeforeDownload?: 'windows-unsigned';
};

export const DOWNLOADS: DownloadItem[] = [
  {
    id: 'play',
    label: 'Google Play',
    icon: 'android',
    href: process.env.NEXT_PUBLIC_DOWNLOAD_PLAY ?? '',
  },
  {
    id: 'ios',
    label: 'App Store',
    icon: 'phone_iphone',
    href: process.env.NEXT_PUBLIC_DOWNLOAD_IOS ?? '',
  },
  {
    id: 'windows',
    label: 'Windows',
    icon: 'desktop_windows',
    href: process.env.NEXT_PUBLIC_DOWNLOAD_WINDOWS ?? '',
    warnBeforeDownload: 'windows-unsigned',
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: 'terminal',
    href: process.env.NEXT_PUBLIC_DOWNLOAD_LINUX ?? '',
  },
  {
    id: 'macos',
    label: 'macOS',
    icon: 'laptop_mac',
    href: process.env.NEXT_PUBLIC_DOWNLOAD_MACOS ?? '',
  },
];

export const WINDOWS_UNSIGNED_STEPS = [
  'Kurulum dosyası şu an kod imzası (Authenticode) olmadan dağıtılıyor; bu yüzden Windows SmartScreen uyarısı gösterebilir.',
  'Uyarı penceresinde «Diğer bilgiler» (More info) seçeneğine tıkla.',
  'Ardından «Yine de çalıştır» (Run anyway) ile kuruluma devam et.',
  'Dosyayı yalnızca resmi siteden veya GitHub Releases sayfamızdan indir. Başka bir kaynaktan indirme.',
] as const;
