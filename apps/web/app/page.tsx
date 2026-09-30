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
    body: 'Topluluklarını oluştur, metin ve ses kanallarını düzenle, davetlerle arkadaşlarını çağır.',
  },
  {
    icon: 'graphic_eq',
    title: 'Sesli odalar',
    body: 'Anlık ses, kamera ve ekran paylaşımı. Sahne görünümü ve kişi başı ses kontrolü hazır.',
  },
  {
    icon: 'music_note',
    title: 'Müzik botu',
    body: 'Ses kanalında birlikte dinle; kuyruk ve çalma paneli sohbetin yanında durur.',
  },
  {
    icon: 'shield_person',
    title: 'Roller & yetkiler',
    body: 'Renkli roller, rozetler ve kanal yetkileriyle sunucunu güvende tut.',
  },
  {
    icon: 'group',
    title: 'Arkadaşlar & DM',
    body: 'Arkadaşlık istekleri, direkt mesajlar ve varlığını gösteren durumlar.',
  },
  {
    icon: 'alternate_email',
    title: 'Bahsetme & arama',
    body: '@kişi, #kanal, bildirimler ve geçmiş mesajlarda hızlı arama.',
  },
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Google ile gir',
    body: 'Hesabını saniyeler içinde aç; kullanıcı adını seç, Draco seni karşılar.',
  },
  {
    n: '02',
    title: 'Sunucu kur veya katıl',
    body: 'Kendi zindanını oluştur ya da davet linkiyle bir topluluğa düş.',
  },
  {
    n: '03',
    title: 'Sohbete dal',
    body: 'Metinde yaz, sese geç, müzik aç — hepsi aynı yerde.',
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
      <style>{`
        @keyframes dracord-rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dracord-glow-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .landing-rise { animation: dracord-rise 0.7s ease-out both; }
        .landing-rise-delay { animation: dracord-rise 0.7s ease-out 0.12s both; }
        .landing-rise-delay-2 { animation: dracord-rise 0.7s ease-out 0.24s both; }
        .landing-glow { animation: dracord-glow-pulse 4.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .landing-rise, .landing-rise-delay, .landing-rise-delay-2, .landing-glow {
            animation: none !important;
          }
        }
      `}</style>

      {/* Hero — brand first, one composition */}
      <section className="relative min-h-[100svh] flex flex-col">
        <div
          className="absolute inset-0 pointer-events-none landing-glow"
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={36} height={36} className="rounded-xl" />
            <span className="font-black tracking-[0.14em] text-sm md:text-base">
              <span className="text-[#bd93f9]">DR</span>
              <span className="text-[#50fa7b]">ACO</span>
              <span className="text-[#bd93f9]">RD</span>
            </span>
          </div>
          <nav className="flex items-center gap-1 md:gap-2">
            <a
              href="#ozellikler"
              className="hidden sm:inline font-label-md text-[#9a95b0] hover:text-[#f8f8f2] transition-colors px-3 py-2"
            >
              Özellikler
            </a>
            <a
              href="#nasil"
              className="hidden sm:inline font-label-md text-[#9a95b0] hover:text-[#f8f8f2] transition-colors px-3 py-2"
            >
              Nasıl?
            </a>
            <Link
              href="/login"
              className="font-label-md text-[#c4a8f0] hover:text-[#f8f8f2] transition-colors px-3 py-2"
            >
              Giriş yap
            </Link>
          </nav>
        </header>

        <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 px-6 md:px-10 pb-16 pt-4 max-w-6xl mx-auto w-full">
          <div className="flex-1 text-center lg:text-left max-w-xl space-y-6">
            <p className="landing-rise font-black tracking-[0.2em] text-xs md:text-sm text-[#50fa7b] uppercase">
              Dracula temalı sohbet
            </p>
            <h1 className="landing-rise-delay text-4xl md:text-6xl font-black leading-[1.05] tracking-tight text-[#f8f8f2]">
              <span className="block tracking-[0.08em] mb-2">
                <span className="text-[#bd93f9]">DR</span>
                <span className="text-[#50fa7b]">ACO</span>
                <span className="text-[#bd93f9]">RD</span>
              </span>
              <span className="block text-[#c4a8f0] text-3xl md:text-5xl font-extrabold">
                Topluluğun için yeni bir zindan.
              </span>
            </h1>
            <p className="landing-rise-delay-2 text-base md:text-lg text-[#9a95b0] max-w-md mx-auto lg:mx-0 leading-relaxed">
              Metin, ses, müzik ve roller — maskot Draco eşliğinde karanlık ama sıcak bir topluluk
              deneyimi.
            </p>
            <div className="landing-rise-delay-2 flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-12 px-8 rounded-full font-bold text-[#1e1e2e] bg-gradient-to-r from-[#ff79c6] to-[#bd93f9] shadow-[0_0_28px_rgba(255,121,198,0.35)] hover:shadow-[0_0_36px_rgba(189,147,249,0.45)] transition-all active:scale-[0.98]"
              >
                Hemen başla
              </Link>
              <a
                href="#ozellikler"
                className="inline-flex items-center justify-center h-12 px-6 rounded-full font-bold text-[#f8f8f2] bg-[#44475a]/60 hover:bg-[#6272a4]/50 transition-colors"
              >
                Keşfet
              </a>
            </div>
          </div>

          <div className="relative flex-shrink-0 flex items-center justify-center landing-rise-delay">
            <div className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full bg-[#50fa7b]/10 blur-3xl landing-glow" aria-hidden />
            <Draco size={280} mood="wave" glow headset className="relative z-10" />
          </div>
        </div>
      </section>

      {/* Features — one purpose */}
      <section id="ozellikler" className="relative px-6 md:px-10 py-20 md:py-28 max-w-5xl mx-auto">
        <div className="text-center mb-14 space-y-3">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#c4a8f0]">Zindanda neler var?</h2>
          <p className="text-[#9a95b0] max-w-lg mx-auto leading-relaxed">
            Sadece sohbet değil — ses, müzik, roller ve arkadaşlık akışları aynı arayüzde.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
          {FEATURES.map((f) => (
            <div key={f.title} className="space-y-3">
              <span className="material-symbols-outlined text-[32px] text-[#bd93f9]">{f.icon}</span>
              <h3 className="font-headline-md text-lg text-[#f8f8f2]">{f.title}</h3>
              <p className="text-sm text-[#9a95b0] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Voice band — atmospheric, no cards */}
      <section className="relative border-y border-[#44475a]/35 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 20% 50%, rgba(80,250,123,0.1), transparent 55%), radial-gradient(ellipse 50% 70% at 90% 40%, rgba(189,147,249,0.14), transparent 50%)',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 md:px-10 py-20 md:py-24 flex flex-col md:flex-row items-center gap-10 md:gap-16">
          <div className="flex-1 space-y-4 text-center md:text-left">
            <p className="font-black tracking-[0.18em] text-xs text-[#50fa7b] uppercase">Ses & sahne</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#f8f8f2]">
              Odada konuş, ekranı paylaş, yan sohbeti aç.
            </h2>
            <p className="text-[#9a95b0] leading-relaxed max-w-md mx-auto md:mx-0">
              Ses kanalındayken metin paneli solda kalır; üyeler sağda. Mikrofonda gürültü
              engelleme, kişi başı ses ve çoklu ekran paylaşımı desteklenir.
            </p>
          </div>
          <div className="relative shrink-0">
            <Draco size={180} mood="idle" glow className="relative z-10" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="nasil" className="relative px-6 md:px-10 py-20 md:py-28 max-w-4xl mx-auto">
        <div className="text-center mb-14 space-y-3">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#c4a8f0]">Üç adımda içeri</h2>
          <p className="text-[#9a95b0] max-w-md mx-auto">Kurulum yok — tarayıcıda aç, Google ile gir, sohbete başla.</p>
        </div>
        <ol className="space-y-10">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-5 md:gap-8 items-start">
              <span className="font-black text-2xl md:text-3xl text-[#bd93f9]/70 tabular-nums shrink-0 w-12">
                {s.n}
              </span>
              <div className="space-y-1 pt-1">
                <h3 className="text-lg font-bold text-[#f8f8f2]">{s.title}</h3>
                <p className="text-sm text-[#9a95b0] leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="relative px-6 md:px-10 pb-24">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#f8f8f2]">
            Draco seni bekliyor.
          </h2>
          <p className="text-[#9a95b0] max-w-md mx-auto">
            Hesabını oluştur, kısa turu tamamla ve ilk sunucuna dal.
          </p>
          <Link
            href="/login"
            className="inline-flex h-12 px-8 items-center rounded-full font-bold text-[#1e1e2e] bg-[#50fa7b] hover:bg-[#8affb0] transition-colors"
          >
            Hesap oluştur / giriş yap
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#44475a]/40 px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto text-sm text-[#6272a4]">
        <span>Dracord · Draco ile sohbet</span>
        <div className="flex gap-4">
          <Link href="/settings/privacy-policy" className="hover:text-[#c4a8f0] transition-colors">
            Gizlilik
          </Link>
          <Link href="/settings/terms" className="hover:text-[#c4a8f0] transition-colors">
            Koşullar
          </Link>
        </div>
      </footer>
    </div>
  );
}
