import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { GlobalSearch } from '@/components/GlobalSearch';
import { OnboardingGate } from '@/components/OnboardingGate';
import { VoiceSessionProvider } from '@/components/VoiceSessionProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Dracord',
    template: '%s · Dracord',
  },
  description: 'Dracula temalı topluluk sohbeti — metin, ses ve arkadaşlar.',
  applicationName: 'Dracord',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-icon', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'Dracord',
    title: 'Dracord',
    description: 'Dracula temalı topluluk sohbeti — metin, ses ve arkadaşlar.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dracord',
    description: 'Dracula temalı topluluk sohbeti — metin, ses ve arkadaşlar.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`dark ${inter.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          <OnboardingGate>
            <VoiceSessionProvider>
              <Suspense fallback={null}>
                <GlobalSearch />
              </Suspense>
              {children}
            </VoiceSessionProvider>
          </OnboardingGate>
        </AuthProvider>
      </body>
    </html>
  );
}
