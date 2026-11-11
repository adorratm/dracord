'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Draco } from '@/components/Draco';
import { DownloadPlatformGrid } from '@/components/DownloadPlatformGrid';
import { useAuth } from '@/components/AuthProvider';
import { hasSession } from '@/lib/storage';

/* ───────────── İçerik (yalnız gerçekten var olan özellikler) ───────────── */

const NAV = [
  { id: 'ozellikler', label: 'Özellikler' },
  { id: 'oyunlar', label: 'Oyunlar' },
  { id: 'guvenlik', label: 'Güvenlik' },
  { id: 'indir', label: 'İndir' },
] as const;

const FACTS = [
  { value: '5', label: 'platform', hint: 'Web · Windows · macOS · Linux · Android (iOS yakında)' },
  { value: '7', label: 'yerleşik oyun', hint: 'Bilardo, 101 Okey, Tavla ve dahası' },
  { value: '0 ₺', label: 'bulut yapay zekâ', hint: 'Altyazı ve çeviri cihazında çalışır' },
  { value: 'E2EE', label: 'isteğe bağlı', hint: 'Uçtan uca şifreli özel mesaj' },
] as const;

type Tone = 'purple' | 'green' | 'pink' | 'cyan' | 'orange' | 'yellow';

const TONE: Record<Tone, { text: string; bg: string; ring: string; glow: string }> = {
  purple: { text: 'text-[#bd93f9]', bg: 'bg-[#bd93f9]/12', ring: 'ring-[#bd93f9]/25', glow: 'rgba(189,147,249,0.22)' },
  green: { text: 'text-[#50fa7b]', bg: 'bg-[#50fa7b]/10', ring: 'ring-[#50fa7b]/25', glow: 'rgba(80,250,123,0.18)' },
  pink: { text: 'text-[#ff79c6]', bg: 'bg-[#ff79c6]/10', ring: 'ring-[#ff79c6]/25', glow: 'rgba(255,121,198,0.2)' },
  cyan: { text: 'text-[#8be9fd]', bg: 'bg-[#8be9fd]/10', ring: 'ring-[#8be9fd]/25', glow: 'rgba(139,233,253,0.18)' },
  orange: { text: 'text-[#ffb86c]', bg: 'bg-[#ffb86c]/10', ring: 'ring-[#ffb86c]/25', glow: 'rgba(255,184,108,0.18)' },
  yellow: { text: 'text-[#f1fa8c]', bg: 'bg-[#f1fa8c]/10', ring: 'ring-[#f1fa8c]/25', glow: 'rgba(241,250,140,0.14)' },
};

const BENTO: Array<{
  icon: string;
  tone: Tone;
  title: string;
  body: string;
  tags?: string[];
  span?: string;
}> = [
  {
    icon: 'graphic_eq',
    tone: 'purple',
    title: 'Ses, kamera ve ekran paylaşımı',
    body: 'Düşük gecikmeli sesli odalar, çoklu ekran paylaşımı, kişi başı ses ayarı ve gürültü engelleme. Paylaşılan ekrana birlikte çiz, izin verirsen arkadaşın bilgisayarını uzaktan kontrol etsin.',
    tags: ['Ekrana çizim', 'Uzak kontrol', 'Klip kaydı (Ctrl+Shift+K)', 'Oyun içi HUD'],
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    icon: 'closed_caption',
    tone: 'cyan',
    title: 'Canlı altyazı',
    body: 'Konuşmalar ses kanalında anlık yazıya dökülür. Tanıma senin cihazında yapılır; ses hiçbir sunucuya gitmez.',
  },
  {
    icon: 'lock',
    tone: 'green',
    title: 'Uçtan uca şifreli DM',
    body: 'İstersen özel sohbeti şifrele: içerik yalnız sizin cihazlarınızda açılır, güvenlik koduyla doğrularsınız.',
  },
  {
    icon: 'sports_esports',
    tone: 'pink',
    title: 'Oyunlar ve turnuvalar',
    body: 'Kanalda bilardo, okey, tavla; sunucuna eleme turnuvası kur, eşleşmeleri Dracord yönetsin.',
    span: 'md:col-span-2',
  },
  {
    icon: 'military_tech',
    tone: 'yellow',
    title: 'Seviye, görev, sezon',
    body: 'Mesaj ve sesle XP kazan; her hafta yeni görevler, sezon sıralaması ve sunucu rozetleri.',
  },
  {
    icon: 'smart_toy',
    tone: 'orange',
    title: 'Draco bot ve otomatik moderasyon',
    body: 'Sunucunun SSS’sini yanıtlayan Draco, yasaklı kelime ve spam koruması, kural tabanlı ve ücretsiz.',
  },
  {
    icon: 'translate',
    tone: 'cyan',
    title: 'Çeviri ve “Ne kaçırdım?”',
    body: 'Mesajları tek tıkla çevir; uzaktayken kaçırdığın bahsetmeleri ve öne çıkan mesajları tek ekranda gör.',
  },
  {
    icon: 'mic',
    tone: 'purple',
    title: 'Sesli mesaj ve soundboard',
    body: 'Sesli not bırak, mesajı ileri bir saate zamanla, ses kanalında kısa efektleri çal.',
  },
  {
    icon: 'queue_music',
    tone: 'green',
    title: 'Müzik botu ve Watch Party',
    body: '/oynat ile ortak kuyruk; arkadaşlarınla aynı videoyu senkron izle.',
    span: 'md:col-span-2',
  },
  {
    icon: 'insights',
    tone: 'pink',
    title: 'Sunucunu büyüt',
    body: 'Kendi adresinle tanıtım sayfası (dracord.com.tr/s/…), Keşfet listesi ve sunucu istatistikleri.',
    span: 'md:col-span-2',
  },
];

const GAMES = [
  { icon: 'sports_baseball', name: 'Bilardo' },
  { icon: 'grid_view', name: '101 Okey' },
  { icon: 'casino', name: 'Tavla' },
  { icon: 'sports_cricket', name: 'Bowling' },
  { icon: 'style', name: 'Blackjack' },
  { icon: 'quiz', name: 'Bilgi yarışması' },
  { icon: 'spellcheck', name: 'Kelime oyunu' },
  { icon: 'live_tv', name: 'Watch Party' },
] as const;

const SECURITY = [
  { icon: 'lock', title: 'Şifreli özel mesaj', body: 'Cihaz anahtarları, güvenlik kodu, yeni cihaz uyarısı.' },
  { icon: 'passkey', title: 'Passkey ile giriş', body: 'Şifresiz, oltalamaya dayanıklı giriş (web).' },
  { icon: 'devices', title: 'Oturum yönetimi', body: 'Açık cihazları gör, tek tıkla hepsinden çıkış yap.' },
  { icon: 'shield', title: 'Otomatik moderasyon', body: 'Yasaklı kelime, spam, bağlantı ve etiket koruması.' },
] as const;

const STEPS = [
  { n: '01', title: 'Giriş yap', body: 'Google hesabınla ya da passkey ile saniyeler içinde gir.' },
  { n: '02', title: 'Sunucunu kur', body: 'Kanalları düzenle ya da bir davet linkiyle bir topluluğa katıl.' },
  { n: '03', title: 'Sese ve oyuna dal', body: 'Sese geç, ekranını paylaş, kanalda bir el okey aç.' },
] as const;

/* ───────────── Küçük yapı taşları ───────────── */

function Eyebrow({ children, tone = 'green' }: { children: ReactNode; tone?: Tone }) {
  return (
    <p className={`font-black tracking-[0.2em] text-xs uppercase ${TONE[tone].text}`}>{children}</p>
  );
}

function SectionHead({ eyebrow, title, body, tone }: { eyebrow: string; title: ReactNode; body?: ReactNode; tone?: Tone }) {
  return (
    <div className="text-center mb-12 md:mb-16 space-y-4 max-w-2xl mx-auto" data-reveal>
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      <h2 className="l-balance text-3xl md:text-5xl font-black tracking-tight text-[#f8f8f2]">{title}</h2>
      {body ? <p className="l-pretty text-base md:text-lg text-[#a9a4c0] leading-relaxed">{body}</p> : null}
    </div>
  );
}

/** Hero sağındaki uygulama önizlemesi — gerçek arayüzün sade bir çizimi (ekran görüntüsü değil) */
function AppPreview() {
  const tiles = [
    { name: 'Ayşe', color: '#ff79c6', speaking: true },
    { name: 'Mert', color: '#8be9fd', speaking: false },
    { name: 'Draco', color: '#50fa7b', speaking: false, draco: true },
    { name: 'Zeynep', color: '#ffb86c', speaking: false },
  ];
  return (
    <div className="relative w-full max-w-[520px]" aria-hidden>
      <div className="absolute -inset-6 rounded-[36px] bg-[radial-gradient(closest-side,rgba(189,147,249,0.28),transparent)] blur-2xl l-glow" />
      <div className="relative rounded-[28px] border border-white/10 bg-[#1b1828]/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(189,147,249,0.08)] backdrop-blur overflow-hidden">
        <div className="flex items-center gap-2 px-4 h-10 border-b border-white/5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5555]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f1fa8c]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#50fa7b]/80" />
          <span className="ml-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#a9a4c0]">
            <span className="material-symbols-outlined text-[14px] text-[#50fa7b]">graphic_eq</span>
            Genel · ses kanalı
          </span>
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-[#50fa7b] tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full bg-[#50fa7b] l-pulse" /> 24 ms
          </span>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2.5">
          {tiles.map((t) => (
            <div
              key={t.name}
              className={`relative aspect-[16/10] rounded-2xl bg-[#13111c] flex items-center justify-center overflow-hidden ${t.speaking ? 'ring-2 ring-[#50fa7b] l-speak' : 'ring-1 ring-white/5'}`}
            >
              {t.draco ? (
                <Draco size={64} mood="idle" />
              ) : (
                <span
                  className="h-12 w-12 rounded-full flex items-center justify-center font-black text-[#13111c] text-lg"
                  style={{ background: t.color }}
                >
                  {t.name[0]}
                </span>
              )}
              <span className="absolute left-2 bottom-1.5 text-[10px] font-semibold text-[#f8f8f2]/85">{t.name}</span>
              {t.name === 'Mert' ? (
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 100" fill="none">
                  <path
                    className="l-draw"
                    d="M30 70 C 50 30, 80 30, 95 55 S 130 80, 140 35"
                    stroke="#ff79c6"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mx-3 mb-3 rounded-xl bg-black/40 px-3 py-2 text-[12px] leading-snug text-[#f8f8f2]">
          <span className="font-bold text-[#ff79c6]">Ayşe:</span>{' '}
          <span className="l-caption">bu akşam okey turnuvası var, katılan?</span>
          <span className="ml-1 inline-block w-1.5 h-3 align-middle bg-[#f8f8f2]/70 l-caret" />
        </div>
        <div className="flex items-center gap-1.5 px-3 pb-3">
          {['mic', 'videocam', 'screen_share', 'closed_caption', 'stylus'].map((i, idx) => (
            <span
              key={i}
              className={`h-9 flex-1 rounded-xl flex items-center justify-center ${idx === 3 ? 'bg-[#8be9fd]/15 text-[#8be9fd]' : 'bg-white/5 text-[#c9c4dc]'}`}
            >
              <span className="material-symbols-outlined text-[18px]">{i}</span>
            </span>
          ))}
          <span className="h-9 w-12 rounded-xl flex items-center justify-center bg-[#ff5555]/85 text-[#13111c]">
            <span className="material-symbols-outlined text-[18px]">call_end</span>
          </span>
        </div>
      </div>

      <div className="absolute -left-6 md:-left-12 top-16 rounded-2xl border border-white/10 bg-[#1f1b2e]/95 px-3 py-2 shadow-xl flex items-center gap-2 l-float-slow">
        <span className="material-symbols-outlined text-[18px] text-[#50fa7b]">lock</span>
        <span className="text-[11px] font-semibold text-[#f8f8f2]">Uçtan uca şifreli</span>
      </div>
      <div className="absolute -right-4 md:-right-10 bottom-24 rounded-2xl border border-white/10 bg-[#1f1b2e]/95 px-3 py-2 shadow-xl flex items-center gap-2 l-float-slow-2">
        <span className="material-symbols-outlined text-[18px] text-[#ffb86c]">emoji_events</span>
        <span className="text-[11px] font-semibold text-[#f8f8f2]">Turnuva · Yarı final</span>
      </div>
    </div>
  );
}

/* ───────────── Sayfa ───────────── */

export default function LandingPage() {
  const router = useRouter();
  const { ready, user } = useAuth();
  /** Oturum varsa uygulamaya yönlendirilirken içerik yerine maskot göster */
  const [redirecting, setRedirecting] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // İçerik sunucuda hazır gelir (LCP için oturum kontrolünü beklemez); oturum varsa yönlendir
  useEffect(() => {
    if (hasSession()) setRedirecting(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (user || hasSession()) {
      setRedirecting(true);
      router.replace('/channels/@me');
    } else {
      setRedirecting(false);
    }
  }, [ready, user, router]);
  const checking = redirecting;

  const scrollToId = useCallback((id: string) => {
    const root = scrollerRef.current;
    const el = root?.querySelector(`#${CSS.escape(id)}`);
    if (!root || !el) return;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 72;
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
    if (hash) requestAnimationFrame(() => scrollToId(hash));
  }, [checking, scrollToId]);

  // Kaydırınca beliren içerik + yapışkan başlık gölgesi
  useEffect(() => {
    if (checking) return;
    const root = scrollerRef.current;
    if (!root) return;
    const onScroll = () => setScrolled(root.scrollTop > 12);
    root.addEventListener('scroll', onScroll, { passive: true });
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      nodes.forEach((n) => n.setAttribute('data-in', ''));
      return () => root.removeEventListener('scroll', onScroll);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute('data-in', '');
            io.unobserve(e.target);
          }
        }
      },
      { root, rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => {
      io.disconnect();
      root.removeEventListener('scroll', onScroll);
    };
  }, [checking]);

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
      className="h-full overflow-y-auto overflow-x-hidden bg-[#13111c] text-[#f8f8f2] antialiased"
    >
      <style>{`
        @keyframes l-rise { from { opacity: 0; transform: translateY(22px); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
        @keyframes l-glow { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
        @keyframes l-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes l-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        @keyframes l-speak { 0%, 100% { box-shadow: 0 0 0 0 rgba(80,250,123,.45); } 50% { box-shadow: 0 0 0 6px rgba(80,250,123,0); } }
        @keyframes l-draw { 0% { stroke-dashoffset: 220; opacity: 1; } 55% { stroke-dashoffset: 0; opacity: 1; } 85%, 100% { stroke-dashoffset: 0; opacity: 0; } }
        @keyframes l-type { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        @keyframes l-caret { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes l-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .l-rise { animation: l-rise .8s cubic-bezier(.22,1,.36,1) both; }
        .l-d1 { animation-delay: .08s; } .l-d2 { animation-delay: .16s; } .l-d3 { animation-delay: .24s; }
        .l-glow { animation: l-glow 6s ease-in-out infinite; }
        .l-float { animation: l-float 6s ease-in-out infinite; }
        .l-float-slow { animation: l-float 7s ease-in-out infinite; }
        .l-float-slow-2 { animation: l-float 8s ease-in-out 1s infinite; }
        .l-pulse { animation: l-pulse 1.6s ease-in-out infinite; }
        .l-speak { animation: l-speak 1.4s ease-out infinite; }
        .l-draw { stroke-dasharray: 220; animation: l-draw 4.5s ease-in-out infinite; }
        .l-caption { display: inline-block; animation: l-type 3.2s steps(36) 0.6s both; }
        .l-caret { animation: l-caret 1s steps(1) infinite; }
        .l-marquee { animation: l-marquee 38s linear infinite; }
        .l-balance { text-wrap: balance; }
        .l-pretty { text-wrap: pretty; }
        [data-reveal] { opacity: 0; transform: translateY(18px); transition-property: opacity, transform; transition-duration: .7s; transition-timing-function: cubic-bezier(.22,1,.36,1); }
        [data-reveal][data-in] { opacity: 1; transform: none; }
        .l-card { transition-property: transform, border-color, background-color; transition-duration: .25s; transition-timing-function: ease; }
        .l-card:hover { transform: translateY(-4px); border-color: rgba(189,147,249,.35); }
        .l-card:hover .l-card-icon { transform: scale(1.08) rotate(-4deg); }
        .l-card-icon { transition-property: transform; transition-duration: .25s; }
        .l-btn { transition-property: transform, box-shadow, background-color, color; transition-duration: .2s; }
        .l-btn:active { transform: scale(.97); }
        @media (prefers-reduced-motion: reduce) {
          .l-rise, .l-glow, .l-float, .l-float-slow, .l-float-slow-2, .l-pulse, .l-speak, .l-draw, .l-caption, .l-caret, .l-marquee { animation: none !important; }
          .l-draw { stroke-dashoffset: 0; }
          [data-reveal] { opacity: 1; transform: none; transition: none; }
          .l-card:hover, .l-card:hover .l-card-icon { transform: none; }
        }
      `}</style>

      {/* ───── Üst çubuk ───── */}
      <header
        className={`sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300 border-b ${
          scrolled ? 'bg-[#13111c]/80 backdrop-blur-xl border-white/5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]' : 'bg-transparent border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 md:px-8 h-16">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd93f9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={32} height={32} className="rounded-lg" />
            <span className="font-black tracking-[0.14em] text-sm">
              <span className="text-[#bd93f9]">DR</span>
              <span className="text-[#50fa7b]">ACO</span>
              <span className="text-[#bd93f9]">RD</span>
            </span>
          </Link>
          <nav aria-label="Sayfa bölümleri" className="flex items-center gap-1">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                onClick={(e) => onHashClick(e, n.id)}
                className="hidden md:inline-flex h-10 items-center px-3 rounded-lg text-sm font-semibold text-[#a9a4c0] hover:text-[#f8f8f2] hover:bg-white/5 transition-colors"
              >
                {n.label}
              </a>
            ))}
            <Link
              href="/login"
              className="l-btn ml-1 inline-flex h-10 items-center px-4 rounded-full text-sm font-bold text-[#13111c] bg-[#f8f8f2] hover:bg-white"
            >
              Giriş yap
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ───── Hero ───── */}
        <section className="relative -mt-16 pt-16 overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
            style={{
              background:
                'radial-gradient(ellipse 70% 55% at 75% 30%, rgba(189,147,249,0.22), transparent 60%), radial-gradient(ellipse 45% 40% at 10% 75%, rgba(255,121,198,0.13), transparent 60%), radial-gradient(ellipse 40% 35% at 40% 0%, rgba(80,250,123,0.08), transparent 60%)',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.06]"
            aria-hidden
            style={{
              backgroundImage:
                'linear-gradient(rgba(189,147,249,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(189,147,249,0.6) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent)',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-16 md:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-10 items-center">
            <div className="text-center lg:text-left">
              <div className="l-rise inline-flex items-center gap-2 rounded-full border border-[#50fa7b]/25 bg-[#50fa7b]/10 px-3 py-1.5 text-xs font-bold text-[#50fa7b]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#50fa7b] l-pulse" />
                Ücretsiz · Reklamsız · Türkçe
              </div>
              <h1 className="l-rise l-d1 l-balance mt-6 text-[2.6rem] leading-[1.02] md:text-7xl font-black tracking-tight">
                Sohbet, ses ve oyun
                <span className="block bg-gradient-to-r from-[#bd93f9] via-[#ff79c6] to-[#ffb86c] bg-clip-text text-transparent pb-1">
                  tek zindanda.
                </span>
              </h1>
              <p className="l-rise l-d2 l-pretty mt-6 text-lg md:text-xl text-[#a9a4c0] leading-relaxed max-w-xl mx-auto lg:mx-0">
                Dracord; topluluğun için sesli odalar, ekran paylaşımı, kanal içi oyunlar ve şifreli özel
                mesajları tek uygulamada toplar. Maskotumuz Draco da yanında.
              </p>
              <div className="l-rise l-d3 mt-9 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <Link
                  href="/login"
                  className="l-btn inline-flex items-center gap-2 h-13 min-h-[52px] px-8 rounded-full font-bold text-[#13111c] bg-gradient-to-r from-[#ff79c6] to-[#bd93f9] shadow-[0_10px_40px_-8px_rgba(255,121,198,0.55)] hover:shadow-[0_14px_48px_-6px_rgba(189,147,249,0.65)] hover:-translate-y-0.5"
                >
                  Tarayıcıda başla
                  <span className="material-symbols-outlined text-[20px]" aria-hidden>arrow_forward</span>
                </Link>
                <a
                  href="#indir"
                  onClick={(e) => onHashClick(e, 'indir')}
                  className="l-btn inline-flex items-center gap-2 min-h-[52px] px-6 rounded-full font-bold text-[#f8f8f2] bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/10 hover:-translate-y-0.5"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden>download</span>
                  Uygulamayı indir
                </a>
              </div>
              <p className="l-rise l-d3 mt-5 text-sm text-[#8a85a3]">Web · Windows · macOS · Linux · Android · iOS yakında</p>
            </div>
            <div className="l-rise l-d2 flex justify-center lg:justify-end">
              <AppPreview />
            </div>
          </div>
        </section>

        {/* ───── Gerçekler şeridi ───── */}
        <section aria-label="Kısaca Dracord" className="relative border-y border-white/5 bg-white/[0.015]">
          <dl className="max-w-6xl mx-auto px-5 md:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
            {FACTS.map((f, i) => (
              <div key={f.label} className="text-center md:text-left" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <dt className="sr-only">{f.label}</dt>
                <dd>
                  <span className="block text-3xl md:text-4xl font-black tabular-nums text-[#f8f8f2]">{f.value}</span>
                  <span className="block mt-1 text-sm font-bold text-[#bd93f9]">{f.label}</span>
                  <span className="block mt-1 text-xs text-[#8a85a3] leading-snug">{f.hint}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ───── Özellikler (bento) ───── */}
        <section id="ozellikler" className="relative max-w-6xl mx-auto px-5 md:px-8 py-24 md:py-32 scroll-mt-20">
          <SectionHead
            eyebrow="Özellikler"
            tone="purple"
            title={<>Bir toplulukta ne lazımsa, <span className="text-[#bd93f9]">burada.</span></>}
            body="Metin ve ses kanallarından turnuvalara, canlı altyazıdan şifreli mesaja kadar — hepsi aynı Dracula arayüzünde."
          />
          <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[minmax(190px,auto)] gap-4">
            {BENTO.map((b, i) => {
              const t = TONE[b.tone];
              const big = b.span?.includes('row-span-2');
              return (
                <article
                  key={b.title}
                  data-reveal
                  style={{ transitionDelay: `${(i % 4) * 60}ms` }}
                  className={`l-card group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#1a1726] p-6 md:p-7 flex flex-col ${b.span ?? ''}`}
                >
                  <div
                    className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: t.glow }}
                    aria-hidden
                  />
                  <span className={`l-card-icon relative inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${t.bg} ${t.ring}`}>
                    <span className={`material-symbols-outlined text-[26px] ${t.text}`} aria-hidden>{b.icon}</span>
                  </span>
                  <h3 className={`relative mt-5 font-black tracking-tight text-[#f8f8f2] ${big ? 'text-2xl md:text-3xl' : 'text-lg'}`}>
                    {b.title}
                  </h3>
                  <p className={`relative l-pretty mt-2 text-[#a9a4c0] leading-relaxed ${big ? 'text-base md:text-lg' : 'text-sm'}`}>{b.body}</p>
                  {b.tags ? (
                    <ul className="relative mt-auto pt-6 flex flex-wrap gap-2">
                      {b.tags.map((tag) => (
                        <li key={tag} className="rounded-full bg-white/[0.06] ring-1 ring-white/10 px-3 py-1 text-xs font-semibold text-[#d8d3ea]">
                          {tag}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {big ? (
                    <div className="relative mt-6 hidden md:flex justify-end" aria-hidden>
                      <div className="l-float">
                        <Draco size={130} mood="wave" headset glow />
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        {/* ───── Cihaz üstü yapay zekâ ───── */}
        <section className="relative overflow-hidden border-y border-white/5">
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
            style={{
              background:
                'radial-gradient(ellipse 50% 70% at 15% 50%, rgba(139,233,253,0.12), transparent 60%), radial-gradient(ellipse 45% 70% at 90% 40%, rgba(80,250,123,0.1), transparent 60%)',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-24 md:py-28 grid md:grid-cols-2 gap-12 items-center">
            <div data-reveal className="space-y-5 text-center md:text-left">
              <Eyebrow tone="cyan">Akıllı ama gizli</Eyebrow>
              <h2 className="l-balance text-3xl md:text-5xl font-black tracking-tight">
                Yapay zekâ <span className="text-[#8be9fd]">senin cihazında</span> çalışır.
              </h2>
              <p className="l-pretty text-lg text-[#a9a4c0] leading-relaxed">
                Canlı altyazı ve mesaj çevirisi tarayıcının ya da uygulamanın içinde yapılır. Sesin ve
                mesajların bir yapay zekâ sunucusuna gönderilmez; bu yüzden Dracord’da bunlar ücretsiz.
              </p>
            </div>
            <ul data-reveal className="grid gap-3">
              {[
                { icon: 'closed_caption', title: 'Canlı altyazı', body: 'Konuşan kişinin cihazında tanınır, yalnız metin paylaşılır.' },
                { icon: 'translate', title: 'Mesaj çevirisi', body: 'Türkçe ↔ İngilizce, model ilk kullanımda bir kez iner.' },
                { icon: 'summarize', title: '“Ne kaçırdım?”', body: 'Bahsetmeler, yanıtlar, öne çıkan mesajlar tek ekranda.' },
              ].map((x) => (
                <li key={x.title} className="flex gap-4 rounded-2xl border border-white/[0.07] bg-[#1a1726]/80 p-5">
                  <span className="material-symbols-outlined text-[26px] text-[#8be9fd] shrink-0" aria-hidden>{x.icon}</span>
                  <span>
                    <span className="block font-bold text-[#f8f8f2]">{x.title}</span>
                    <span className="block mt-1 text-sm text-[#a9a4c0]">{x.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ───── Oyunlar ───── */}
        <section id="oyunlar" className="relative py-24 md:py-32 scroll-mt-20 overflow-hidden">
          <div className="max-w-6xl mx-auto px-5 md:px-8">
            <SectionHead
              eyebrow="Oyunlar"
              tone="pink"
              title={<>Kanalda bir el aç, <span className="text-[#ff79c6]">turnuvaya</span> çevir.</>}
              body="Oyunlar doğrudan kanalda oynanır; kurulum yok. Sunucuna eleme turnuvası kur, sonuçları Dracord takip etsin. Geliştiriciler kendi oyunlarını Oyun SDK’sı ile ekleyebilir."
            />
          </div>
          <div className="relative" data-reveal>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#13111c] to-transparent z-10" aria-hidden />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#13111c] to-transparent z-10" aria-hidden />
            <ul className="sr-only">
              {GAMES.map((g) => (
                <li key={g.name}>{g.name}</li>
              ))}
            </ul>
            <div className="flex w-max gap-4 l-marquee hover:[animation-play-state:paused]" aria-hidden>
              {[...GAMES, ...GAMES].map((g, i) => (
                <div
                  key={`${g.name}-${i}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#1a1726] px-6 py-5"
                >
                  <span className="material-symbols-outlined text-[28px] text-[#ff79c6]">{g.icon}</span>
                  <span className="text-lg font-bold text-[#f8f8f2] whitespace-nowrap">{g.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── Güvenlik ───── */}
        <section id="guvenlik" className="relative max-w-6xl mx-auto px-5 md:px-8 pb-24 md:pb-32 scroll-mt-20">
          <SectionHead
            eyebrow="Güvenlik ve gizlilik"
            tone="green"
            title={<>Verin <span className="text-[#50fa7b]">satılık değil.</span></>}
            body="Reklam yok, veri satışı yok. KVKK aydınlatma metni, gizlilik politikası ve topluluk kuralları herkese açık."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SECURITY.map((s, i) => (
              <div
                key={s.title}
                data-reveal
                style={{ transitionDelay: `${i * 60}ms` }}
                className="l-card rounded-3xl border border-white/[0.07] bg-[#1a1726] p-6"
              >
                <span className="material-symbols-outlined text-[28px] text-[#50fa7b]" aria-hidden>{s.icon}</span>
                <h3 className="mt-4 font-bold text-[#f8f8f2]">{s.title}</h3>
                <p className="mt-1.5 text-sm text-[#a9a4c0] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm" data-reveal>
            {[
              ['/legal/privacy', 'Gizlilik politikası'],
              ['/legal/kvkk', 'KVKK'],
              ['/legal/terms', 'Kullanım koşulları'],
              ['/legal/community', 'Topluluk kuralları'],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="font-semibold text-[#bd93f9] hover:text-[#d6bcff] underline-offset-4 hover:underline">
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* ───── Üç adım ───── */}
        <section className="relative border-y border-white/5 bg-white/[0.015]">
          <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-24">
            <SectionHead eyebrow="Başlamak kolay" tone="orange" title="Üç adımda içeridesin." />
            <ol className="grid md:grid-cols-3 gap-4">
              {STEPS.map((s, i) => (
                <li
                  key={s.n}
                  data-reveal
                  style={{ transitionDelay: `${i * 80}ms` }}
                  className="relative rounded-3xl border border-white/[0.07] bg-[#1a1726] p-7"
                >
                  <span className="font-black text-5xl tabular-nums bg-gradient-to-b from-[#ffb86c] to-[#ffb86c]/20 bg-clip-text text-transparent">
                    {s.n}
                  </span>
                  <h3 className="mt-3 text-xl font-black text-[#f8f8f2]">{s.title}</h3>
                  <p className="mt-2 text-sm text-[#a9a4c0] leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ───── İndir ───── */}
        <section id="indir" className="relative max-w-5xl mx-auto px-5 md:px-8 py-24 md:py-32 scroll-mt-20">
          <SectionHead
            eyebrow="İndir"
            tone="purple"
            title="Her cihazda Dracord."
            body="Tarayıcıda hemen başla ya da masaüstü ve mobil uygulamayı kur. Masaüstünde oyun içi konuşan göstergesi ve klip kaydı da var."
          />
          <div data-reveal>
            <DownloadPlatformGrid />
          </div>
        </section>

        {/* ───── Son çağrı ───── */}
        <section className="relative px-5 md:px-8 pb-24">
          <div
            data-reveal
            className="relative max-w-5xl mx-auto overflow-hidden rounded-[32px] border border-white/10 px-6 py-14 md:px-14 md:py-16 text-center"
            style={{
              background:
                'radial-gradient(ellipse 80% 120% at 0% 0%, rgba(255,121,198,0.25), transparent 55%), radial-gradient(ellipse 80% 120% at 100% 100%, rgba(189,147,249,0.3), transparent 55%), #1a1726',
            }}
          >
            <div className="mx-auto mb-4 w-fit l-float">
              <Draco size={110} mood="happy" glow />
            </div>
            <h2 className="l-balance text-3xl md:text-5xl font-black tracking-tight">Draco seni bekliyor.</h2>
            <p className="l-pretty mt-4 text-lg text-[#d8d3ea] max-w-xl mx-auto">
              Hesabını aç, ilk sunucunu kur, arkadaşlarını çağır. Ses kanalında müzik için{' '}
              <span className="font-bold text-[#8be9fd]">/oynat</span> yeter.
            </p>
            <Link
              href="/login"
              className="l-btn mt-8 inline-flex items-center gap-2 min-h-[52px] px-8 rounded-full font-bold text-[#13111c] bg-[#50fa7b] hover:bg-[#7dffa0] hover:-translate-y-0.5 shadow-[0_10px_40px_-10px_rgba(80,250,123,0.6)]"
            >
              Ücretsiz hesap aç
              <span className="material-symbols-outlined text-[20px]" aria-hidden>arrow_forward</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#8a85a3]">
          <span>© {new Date().getFullYear()} Dracord · Draco ile sohbet</span>
          <nav aria-label="Yasal" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {[
              ['/legal/privacy', 'Gizlilik'],
              ['/legal/terms', 'Koşullar'],
              ['/legal/kvkk', 'KVKK'],
              ['/legal/cookies', 'Çerezler'],
              ['/legal/community', 'Topluluk'],
              ['/download', 'İndir'],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="hover:text-[#d6bcff] transition-colors">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
