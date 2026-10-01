'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Draco } from '@/components/Draco';
import { useAuth } from '@/components/AuthProvider';
import { hasSession } from '@/lib/storage';

const FEATURES = [
  {
    icon: 'forum',
    title: 'Sunucular & kanallar',
    body: 'Kategoriler, metin/ses kanalları, davet linkleri ve kanal bazlı engellerle topluluğunu yapılandır.',
  },
  {
    icon: 'graphic_eq',
    title: 'Sesli odalar & sahne',
    body: 'Mikrofon, kamera, çoklu ekran paylaşımı, kişi başı ses, gürültü engelleme ve yan sohbet paneli.',
  },
  {
    icon: 'music_note',
    title: 'Müzik botu',
    body: '/oynat ile kuyruğa ekle; oynat/duraklat, atla, sunucu ve yerel ses ayrı kontroller.',
  },
  {
    icon: 'shield_person',
    title: 'Roller & yetkiler',
    body: 'Renkli roller, rozetler, yönetici izinleri ve kanal bazlı erişim kontrolü.',
  },
  {
    icon: 'group',
    title: 'Arkadaşlar & DM',
    body: 'Arkadaşlık istekleri, çevrimdışı listesi, direkt mesajlar ve canlı presence durumu.',
  },
  {
    icon: 'notifications_active',
    title: 'Bildirimler & arama',
    body: '@bahsetme, #kanal, tepkiler, masaüstü bildirimi, okundu yönetimi ve mesaj arama.',
  },
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Google ile gir',
    body: 'Tek tıkla hesap aç; kullanıcı adını seç, Draco seni karşılar ve kısa turu tamamla.',
  },
  {
    n: '02',
    title: 'Sunucu kur veya katıl',
    body: 'Kendi sunucunu oluştur ya da davet linkiyle bir topluluğa düş; kanalları düzenle.',
  },
  {
    n: '03',
    title: 'Sohbete ve sese dal',
    body: 'Metinde yaz, sese geç, müzik aç, ekran paylaş — hepsi aynı Dracula arayüzünde.',
  },
] as const;

export default function LandingPage() {
  const router = useRouter();
  const { ready, user } = useAuth();
  const [checking, setChecking] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready) return;
    if (user || hasSession()) {
      router.replace('/channels/@me');
      return;
    }
    setChecking(false);
  }, [ready, user, router]);

  const scrollToId = useCallback((id: string) => {
    const root = scrollerRef.current;
    const el = root?.querySelector(`#${CSS.escape(id)}`);
    if (!root || !el) return;
    const top =
      el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 12;
    root.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const onHashClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      scrollToId(id);
      window.history.replaceState(null, '', `#${id}`);
    },
    [scrollToId],
  );

  useEffect(() => {
    if (checking) return;
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      requestAnimationFrame(() => scrollToId(hash));
    }
  }, [checking, scrollToId]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#13111c]">
        <Draco size={96} mood="float" glow />
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      className="h-full overflow-y-auto overflow-x-hidden bg-[#13111c] text-[#f8f8f2] scroll-smooth"
    >
      <style>{`
        @keyframes landing-rise {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes landing-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes landing-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes landing-grid {
          from { background-position: 0 0; }
          to { background-position: 48px 48px; }
        }
        .l-rise { animation: landing-rise 0.75s cubic-bezier(0.22,1,0.36,1) both; }
        .l-rise-1 { animation: landing-rise 0.75s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
        .l-rise-2 { animation: landing-rise 0.75s cubic-bezier(0.22,1,0.36,1) 0.2s both; }
        .l-glow { animation: landing-glow 5s ease-in-out infinite; }
        .l-float { animation: landing-float 5.5s ease-in-out infinite; }
        .l-grid-move {
          animation: landing-grid 28s linear infinite;
        }
        .l-feature {
          transition: transform 0.25s ease, color 0.25s ease;
        }
        .l-feature:hover {
          transform: translateY(-4px);
        }
        .l-feature:hover .l-icon {
          color: #50fa7b;
          transform: scale(1.08);
        }
        .l-icon { transition: color 0.25s ease, transform 0.25s ease; }
        @media (prefers-reduced-motion: reduce) {
          .l-rise, .l-rise-1, .l-rise-2, .l-glow, .l-float, .l-grid-move {
            animation: none !important;
          }
          .l-feature:hover { transform: none; }
        }
      `}</style>

      <section className="relative min-h-[100svh] flex flex-col">
        <div
          className="absolute inset-0 pointer-events-none l-glow"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 70% 40%, rgba(189,147,249,0.24), transparent 55%), radial-gradient(ellipse 50% 40% at 15% 80%, rgba(255,121,198,0.14), transparent 50%), linear-gradient(180deg, #13111c 0%, #1a1528 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none l-grid-move"
          style={{
            backgroundImage:
              'linear-gradient(rgba(189,147,249,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(189,147,249,0.45) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          aria-hidden
        />

        <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Dracord" width={36} height={36} className="rounded-xl" />
            <span className="font-black tracking-[0.14em] text-sm md:text-base">
              <span className="text-[#bd93f9]">DR</span>
              <span className="text-[#50fa7b]">ACO</span>
              <span className="text-[#bd93f9]">RD</span>
            </span>
          </div>
          <nav className="flex items-center gap-1 md:gap-2">
            <a
              href="#ozellikler"
              onClick={(e) => onHashClick(e, 'ozellikler')}
              className="hidden sm:inline font-label-md text-[#9a95b0] hover:text-[#f8f8f2] transition-colors px-3 py-2"
            >
              Özellikler
            </a>
            <a
              href="#nasil"
              onClick={(e) => onHashClick(e, 'nasil')}
              className="hidden sm:inline font-label-md text-[#9a95b0] hover:text-[#f8f8f2] transition-colors px-3 py-2"
            >
              Nasıl?
            </a>
            <a
              href="#guvenlik"
              onClick={(e) => onHashClick(e, 'guvenlik')}
              className="hidden md:inline font-label-md text-[#9a95b0] hover:text-[#f8f8f2] transition-colors px-3 py-2"
            >
              Güvenlik
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
            <p className="l-rise font-black tracking-[0.2em] text-xs md:text-sm text-[#50fa7b] uppercase">
              Dracula temalı topluluk sohbeti
            </p>
            <h1 className="l-rise-1 text-4xl md:text-6xl font-black leading-[1.05] tracking-tight text-[#f8f8f2]">
              <span className="block tracking-[0.08em] mb-2">
                <span className="text-[#bd93f9]">DR</span>
                <span className="text-[#50fa7b]">ACO</span>
                <span className="text-[#bd93f9]">RD</span>
              </span>
              <span className="block text-[#c4a8f0] text-3xl md:text-5xl font-extrabold">
                Topluluğun için yeni bir zindan.
              </span>
            </h1>
            <p className="l-rise-2 text-base md:text-lg text-[#9a95b0] max-w-md mx-auto lg:mx-0 leading-relaxed">
              Metin kanalları, düşük gecikmeli ses, müzik botu, roller ve arkadaşlık —
              maskot Draco eşliğinde karanlık ama sıcak bir sohbet deneyimi. Tarayıcıda aç,
              Google ile gir, sunucunu kur.
            </p>
            <div className="l-rise-2 flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-12 px-8 rounded-full font-bold text-[#1e1e2e] bg-gradient-to-r from-[#ff79c6] to-[#bd93f9] shadow-[0_0_28px_rgba(255,121,198,0.35)] hover:shadow-[0_0_36px_rgba(189,147,249,0.45)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Hemen başla
              </Link>
              <a
                href="#ozellikler"
                onClick={(e) => onHashClick(e, 'ozellikler')}
                className="inline-flex items-center justify-center h-12 px-6 rounded-full font-bold text-[#f8f8f2] bg-[#44475a]/60 hover:bg-[#6272a4]/50 transition-all hover:-translate-y-0.5"
              >
                Keşfet
              </a>
            </div>
          </div>

          <div className="relative flex-shrink-0 flex items-center justify-center l-rise-1">
            <div
              className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full bg-[#50fa7b]/10 blur-3xl l-glow"
              aria-hidden
            />
            <div className="relative z-10 l-float">
              <Draco size={280} mood="wave" glow headset />
            </div>
          </div>
        </div>
      </section>

      <section id="ozellikler" className="relative px-6 md:px-10 py-20 md:py-28 max-w-5xl mx-auto scroll-mt-6">
        <div className="text-center mb-14 space-y-3">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#c4a8f0]">Zindanda neler var?</h2>
          <p className="text-[#9a95b0] max-w-xl mx-auto leading-relaxed">
            Discord benzeri akışlar — Dracula paleti, Türkçe arayüz ve Draco maskotu ile.
            Sohbet, ses, müzik ve moderasyon tek yerde.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
          {FEATURES.map((f) => (
            <div key={f.title} className="space-y-3 l-feature">
              <span className="material-symbols-outlined text-[32px] text-[#bd93f9] l-icon">
                {f.icon}
              </span>
              <h3 className="font-headline-md text-lg text-[#f8f8f2]">{f.title}</h3>
              <p className="text-sm text-[#9a95b0] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

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
            <p className="font-black tracking-[0.18em] text-xs text-[#50fa7b] uppercase">
              Ses & sahne
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#f8f8f2]">
              Odada konuş, ekranı paylaş, yan sohbeti aç.
            </h2>
            <p className="text-[#9a95b0] leading-relaxed max-w-md mx-auto md:mx-0">
              LiveKit tabanlı ses; sahne görünümü, bot ile müzik, kişi başı ses kaydırıcıları
              ve AFK taşıma. Bağlantı gecikmesini anlık görürsün.
            </p>
          </div>
          <div className="relative shrink-0 l-float">
            <Draco size={180} mood="idle" glow className="relative z-10" />
          </div>
        </div>
      </section>

      <section id="nasil" className="relative px-6 md:px-10 py-20 md:py-28 max-w-4xl mx-auto scroll-mt-6">
        <div className="text-center mb-14 space-y-3">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#c4a8f0]">Üç adımda içeri</h2>
          <p className="text-[#9a95b0] max-w-md mx-auto">
            Kurulum yok — tarayıcıda aç, Google ile gir, sohbete başla.
          </p>
        </div>
        <ol className="space-y-10">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className="flex gap-5 md:gap-8 items-start group"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="font-black text-2xl md:text-3xl text-[#bd93f9]/70 tabular-nums shrink-0 w-12 group-hover:text-[#50fa7b] transition-colors">
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

      <section id="guvenlik" className="relative px-6 md:px-10 py-16 md:py-20 max-w-4xl mx-auto scroll-mt-6">
        <div className="text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#c4a8f0]">
            Gizlilik ve şeffaflık
          </h2>
          <p className="text-[#9a95b0] max-w-xl mx-auto leading-relaxed">
            Verilerini satmıyoruz. KVKK aydınlatma metni, gizlilik politikası ve topluluk
            kuralları herkese açık. İstersen bildirimleri sustur, DM filtrelerini aç, hesabını
            yönet.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2 text-sm">
            <Link href="/legal/privacy" className="text-[#bd93f9] hover:underline">
              Gizlilik
            </Link>
            <span className="text-[#44475a]">·</span>
            <Link href="/legal/kvkk" className="text-[#bd93f9] hover:underline">
              KVKK
            </Link>
            <span className="text-[#44475a]">·</span>
            <Link href="/legal/terms" className="text-[#bd93f9] hover:underline">
              Koşullar
            </Link>
            <span className="text-[#44475a]">·</span>
            <Link href="/legal/community" className="text-[#bd93f9] hover:underline">
              Topluluk
            </Link>
          </div>
        </div>
      </section>

      <section className="relative px-6 md:px-10 pb-24">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#f8f8f2]">
            Draco seni bekliyor.
          </h2>
          <p className="text-[#9a95b0] max-w-md mx-auto">
            Hesabını oluştur, kısa turu tamamla ve ilk sunucuna dal. Ses kanalında müzik
            açmayı unutma — <span className="text-[#8be9fd] font-semibold">/oynat</span>.
          </p>
          <Link
            href="/login"
            className="inline-flex h-12 px-8 items-center rounded-full font-bold text-[#1e1e2e] bg-[#50fa7b] hover:bg-[#8affb0] transition-all hover:-translate-y-0.5"
          >
            Hesap oluştur / giriş yap
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#44475a]/40 px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto text-sm text-[#6272a4]">
        <span>© {new Date().getFullYear()} Dracord · Draco ile sohbet</span>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/legal/privacy" className="hover:text-[#c4a8f0] transition-colors">
            Gizlilik
          </Link>
          <Link href="/legal/terms" className="hover:text-[#c4a8f0] transition-colors">
            Koşullar
          </Link>
          <Link href="/legal/kvkk" className="hover:text-[#c4a8f0] transition-colors">
            KVKK
          </Link>
          <Link href="/legal/cookies" className="hover:text-[#c4a8f0] transition-colors">
            Çerezler
          </Link>
          <Link href="/legal/community" className="hover:text-[#c4a8f0] transition-colors">
            Topluluk
          </Link>
        </div>
      </footer>
    </div>
  );
}
