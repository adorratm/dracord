'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Draco } from '@/components/Draco';
import { useAuth } from '@/components/AuthProvider';
import { hasSession } from '@/lib/storage';

const FEATURES = [
  {
    icon: 'forum',
    title: 'Sunucular & kanallar',
    body: 'Topluluklarını oluştur, kanallarda sohbet et, roller ve yetkilerle düzenle.',
  },
  {
    icon: 'graphic_eq',
    title: 'Sesli odalar',
    body: 'Arkadaşlarınla anlık sesli sohbet; sahne ve katılımcı paneli hazır.',
  },
  {
    icon: 'alternate_email',
    title: 'Bahsetmeler & arama',
    body: '@kullanıcı, #kanal, bildirimler ve güçlü mesaj araması.',
  },
] as const;

export default function LandingPage() {
  const router = useRouter();
  const { ready, user } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (user || hasSession()) {
      router.replace('/channels/@me');
      return;
    }
    setChecking(false);
  }, [ready, user, router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#13111c]">
        <Draco size={96} mood="float" glow />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#13111c] text-[#f8f8f2] overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-[100svh] flex flex-col">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 70% 40%, rgba(189,147,249,0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 15% 80%, rgba(255,121,198,0.12), transparent 50%), linear-gradient(180deg, #13111c 0%, #1a1528 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(189,147,249,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(189,147,249,0.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          aria-hidden
        />

        <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" width={36} height={36} className="rounded-xl" />
            <span className="font-black tracking-[0.14em] text-sm md:text-base">
              <span className="text-[#bd93f9]">DR</span>
              <span className="text-[#50fa7b]">ACO</span>
              <span className="text-[#bd93f9]">RD</span>
            </span>
          </div>
          <Link
            href="/login"
            className="font-label-md text-[#c4a8f0] hover:text-[#f8f8f2] transition-colors px-3 py-2"
          >
            Giriş yap
          </Link>
        </header>

        <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 px-6 md:px-10 pb-16 pt-4 max-w-6xl mx-auto w-full">
          <div className="flex-1 text-center lg:text-left max-w-xl space-y-6">
            <p className="font-black tracking-[0.2em] text-xs md:text-sm text-[#50fa7b] uppercase">
              Dracula temalı sohbet
            </p>
            <h1 className="text-4xl md:text-6xl font-black leading-[1.05] tracking-tight text-[#f8f8f2]">
              Topluluğun için
              <span className="block text-[#c4a8f0]">yeni bir zindan.</span>
            </h1>
            <p className="text-base md:text-lg text-[#9a95b0] max-w-md mx-auto lg:mx-0 leading-relaxed">
              Metin, ses, anketler ve maskot Draco ile karanlık ama sıcak bir sohbet deneyimi.
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-12 px-8 rounded-full font-bold text-[#1e1e2e] bg-gradient-to-r from-[#ff79c6] to-[#bd93f9] shadow-[0_0_28px_rgba(255,121,198,0.35)] hover:shadow-[0_0_36px_rgba(189,147,249,0.45)] transition-all active:scale-[0.98]"
              >
                Başla
              </Link>
              <a
                href="#ozellikler"
                className="inline-flex items-center justify-center h-12 px-6 rounded-full font-bold text-[#f8f8f2] bg-[#44475a]/60 hover:bg-[#6272a4]/50 transition-colors"
              >
                Nasıl çalışır?
              </a>
            </div>
          </div>

          <div className="relative flex-shrink-0 flex items-center justify-center">
            <div className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full bg-[#50fa7b]/10 blur-3xl" aria-hidden />
            <Draco size={280} mood="wave" glow headset className="relative z-10" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="ozellikler" className="relative px-6 md:px-10 py-20 md:py-28 max-w-5xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#c4a8f0]">
            Draco seni karşılıyor
          </h2>
          <p className="text-[#9a95b0] max-w-lg mx-auto">
            İlk girişten sonra kısa bir tur ile arayüzü tanırsın. Sonra sunucularına dal.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="space-y-3">
              <span className="material-symbols-outlined text-[32px] text-[#bd93f9]">{f.icon}</span>
              <h3 className="font-headline-md text-lg text-[#f8f8f2]">{f.title}</h3>
              <p className="text-sm text-[#9a95b0] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 flex justify-center">
          <Link
            href="/login"
            className="inline-flex h-12 px-8 items-center rounded-full font-bold text-[#1e1e2e] bg-[#50fa7b] hover:bg-[#8affb0] transition-colors"
          >
            Hesap oluştur / giriş yap
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#44475a]/40 px-6 py-8 text-center text-sm text-[#6272a4]">
        Dracord · Draco ile sohbet
      </footer>
    </div>
  );
}
