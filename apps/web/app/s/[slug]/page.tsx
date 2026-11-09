import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { GuildPublicPageDto } from '@dracord/types';

/** Sunucu tanıtım sayfası (B3) — herkese açık, SSR (SEO + paylaşım önizlemesi) */

const API = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

const CATEGORY_TR: Record<string, string> = {
  gaming: 'Oyun',
  music: 'Müzik',
  entertainment: 'Eğlence',
  tech: 'Teknoloji',
  education: 'Eğitim',
};

async function load(slug: string): Promise<GuildPublicPageDto | null> {
  try {
    const res = await fetch(`${API}/public/guilds/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as GuildPublicPageDto;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = await load(slug);
  if (!g) return { title: 'Sunucu bulunamadı', robots: { index: false } };
  const description = (g.description || `${g.name} Dracord sunucusu — ${g.memberCount} üye. Katıl ve sohbete başla.`).slice(0, 200);
  return {
    title: g.name,
    description,
    alternates: { canonical: `/s/${g.vanityCode}` },
    openGraph: {
      title: `${g.name} · Dracord`,
      description,
      url: `/s/${g.vanityCode}`,
      images: g.bannerUrl ? [g.bannerUrl] : g.iconUrl ? [g.iconUrl] : undefined,
    },
    twitter: { card: g.bannerUrl ? 'summary_large_image' : 'summary' },
  };
}

export default async function GuildPublicPage({ params }: Props) {
  const { slug } = await params;
  const g = await load(slug);
  if (!g) notFound();
  const nf = new Intl.NumberFormat('tr-TR');
  const since = new Date(g.createdAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const initials = g.name.trim().slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0d0e17] text-[#f8f8f2]">
      <header className="border-b border-[#44475a]/40 px-6 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="font-black tracking-wide text-[#bd93f9]">
          DRACORD
        </Link>
        <Link href="/download" className="text-sm font-semibold text-[#50fa7b] hover:underline">
          Uygulamayı indir
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="overflow-hidden rounded-2xl border border-[#44475a]/50 bg-[#16171f]">
          <div className="relative h-40 sm:h-52 bg-gradient-to-br from-[#6d4fc2] to-[#2a2c3d]">
            {g.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
          <div className="px-6 pb-6">
            <div className="-mt-10 flex items-end gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-[#16171f] bg-[#2a2c3d] grid place-items-center text-2xl font-black text-[#c4a8f0]">
                {g.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.iconUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 pb-1">
                <h1 className="truncate text-2xl sm:text-3xl font-extrabold text-white">{g.name}</h1>
                <p className="text-sm text-[#a9abc0]">
                  {CATEGORY_TR[g.category] ?? 'Topluluk'} · {since} tarihinden beri
                  {g.boostLevel > 0 ? ` · Takviye seviyesi ${g.boostLevel}` : ''}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-[#2a2c3d] px-3 py-1">
                <strong className="text-white">{nf.format(g.memberCount)}</strong> üye
              </span>
              {g.inVoiceCount > 0 ? (
                <span className="rounded-full bg-[#2a2c3d] px-3 py-1">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#50fa7b] align-middle" aria-hidden />
                  <strong className="text-white">{nf.format(g.inVoiceCount)}</strong> kişi seste
                </span>
              ) : null}
            </div>

            {g.description ? (
              <p className="mt-5 whitespace-pre-wrap break-words leading-relaxed text-[#e6e6f0]">{g.description}</p>
            ) : null}

            {g.channels.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#a9abc0]">Kanallar</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {g.channels.map((c) => (
                    <li key={c} className="rounded-md bg-[#2a2c3d] px-2 py-1 text-sm text-[#e6e6f0]">
                      #{c}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={`/invite/${g.vanityCode}`}
                className="rounded-xl bg-[#50fa7b] px-6 py-3 font-bold text-[#0d0e17] hover:brightness-110"
              >
                Sunucuya katıl
              </Link>
              <span className="text-sm text-[#a9abc0]">
                Adres: <span className="text-white">dracord.com.tr/s/{g.vanityCode}</span>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
