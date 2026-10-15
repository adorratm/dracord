import type { Metadata } from 'next';
import Link from 'next/link';
import { DownloadPlatformGrid } from '@/components/DownloadPlatformGrid';
import { WINDOWS_UNSIGNED_STEPS } from '@/lib/downloads';

export const metadata: Metadata = {
  title: 'İndir',
  description:
    'Dracord’u Google Play, App Store, Windows, Linux veya macOS için indir. Reklamsız Türkçe sesli sohbet.',
  alternates: { canonical: '/download' },
};

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-[#0d0e17] text-[#f8f8f2]">
      <header className="border-b border-[#44475a]/40 px-6 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="font-black tracking-wide text-[#bd93f9]">
          DRACORD
        </Link>
        <Link href="/login" className="text-sm font-semibold text-[#50fa7b] hover:underline">
          Tarayıcıda aç
        </Link>
      </header>

      <main className="px-6 py-14 max-w-3xl mx-auto space-y-10">
        <div className="space-y-3 text-center">
          <p className="font-black tracking-[0.18em] text-xs text-[#50fa7b] uppercase">
            İndir
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#c4a8f0]">
            Dracord uygulamaları
          </h1>
          <p className="text-[#9a95b0] leading-relaxed max-w-xl mx-auto">
            Ücretsiz ve reklamsız çekirdek deneyim. Platform butonları yayın URL’leri
            tanımlandığında aktif olur.
          </p>
        </div>

        <DownloadPlatformGrid compact hideFooterLinks />

        <section className="rounded-2xl border border-[#ffb86c]/35 bg-[#1a1c2c]/90 p-5 md:p-6 space-y-3">
          <h2 className="font-bold text-[#ffb86c] flex items-center gap-2">
            <span className="material-symbols-outlined">desktop_windows</span>
            Windows — SmartScreen
          </h2>
          <p className="text-sm text-[#9a95b0] leading-relaxed">
            Şu an imzalanmış Windows sürümü yok. İndirmeden önce (veya kurulumda uyarı
            çıkarsa) şu adımları izle:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-[#f8f8f2]/90 leading-relaxed">
            {WINDOWS_UNSIGNED_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-[#44475a]/50 bg-[#1a1c2c]/60 p-5 md:p-6 space-y-2">
          <h2 className="font-bold text-[#8be9fd]">macOS</h2>
          <p className="text-sm text-[#9a95b0] leading-relaxed">
            macOS paketi yayınlandığında buradan veya App Store üzerinden indirilebilir.
            Gatekeeper uyarısı görürsen yalnızca resmi kaynaktan indirdiğinden emin ol.
          </p>
        </section>

        <p className="text-center text-sm text-[#6272a4]">
          <Link href="/" className="text-[#bd93f9] hover:underline">
            Anasayfaya dön
          </Link>
        </p>
      </main>
    </div>
  );
}
