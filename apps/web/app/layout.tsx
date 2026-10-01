import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { Analytics } from '@/components/Analytics';
import { GlobalSearch } from '@/components/GlobalSearch';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SettingsReturnTracker } from '@/components/SettingsReturnTracker';
import { VoiceSessionProvider } from '@/components/VoiceSessionProvider';
import { PreferencesProvider } from '@/lib/user-preferences';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://dracord.com.tr';

const siteDescription =
  'Dracord: Dracula temalı topluluk sohbeti. Metin kanalları, sesli odalar, müzik botu, roller, arkadaşlar ve maskot Draco ile sunucunu kur — Türkçe arayüz.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Dracord — Dracula temalı topluluk sohbeti',
    template: '%s · Dracord',
  },
  description: siteDescription,
  applicationName: 'Dracord',
  keywords: [
    'Dracord',
    'sohbet',
    'sesli sohbet',
    'sunucu',
    'Discord alternatifi',
    'Dracula',
    'Draco',
    'topluluk',
    'müzik botu',
    'Türkçe Discord',
    'ekran paylaşımı',
    'KVKK',
  ],
  authors: [{ name: 'Dracord' }],
  creator: 'Dracord',
  publisher: 'Dracord',
  category: 'Social Networking',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-icon', type: 'image/png' }],
  },
  alternates: {
    canonical: '/',
    languages: { 'tr-TR': '/' },
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: siteUrl,
    siteName: 'Dracord',
    title: 'Dracord — Topluluğun için yeni bir zindan',
    description: siteDescription,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Dracord — Draco maskotu',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dracord — Topluluğun için yeni bir zindan',
    description: siteDescription,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  other: {
    'geo.region': 'TR',
    'geo.placename': 'Türkiye',
    'apple-mobile-web-app-title': 'Dracord',
    'application-name': 'Dracord',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Dracord',
    url: siteUrl,
    applicationCategory: 'SocialNetworkingApplication',
    operatingSystem: 'Web',
    description: siteDescription,
    inLanguage: 'tr-TR',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' },
  };

  return (
    <html lang="tr" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <Analytics />
        <AuthProvider>
          <PreferencesProvider>
            <OnboardingGate>
              <VoiceSessionProvider>
                <Suspense fallback={null}>
                  <GlobalSearch />
                </Suspense>
                <SettingsReturnTracker />
                {children}
              </VoiceSessionProvider>
            </OnboardingGate>
          </PreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
