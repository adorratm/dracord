import type { ReactNode } from 'react';
import Link from 'next/link';

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-[#13111c] text-[#f8f8f2]">
      <header className="sticky top-0 z-10 border-b border-[#44475a]/40 bg-[#13111c]/95 backdrop-blur px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="font-black tracking-[0.12em] text-sm">
          <span className="text-[#bd93f9]">DR</span>
          <span className="text-[#50fa7b]">ACO</span>
          <span className="text-[#bd93f9]">RD</span>
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm text-[#9a95b0]">
          <Link href="/legal/privacy" className="hover:text-[#c4a8f0]">
            Gizlilik
          </Link>
          <Link href="/legal/terms" className="hover:text-[#c4a8f0]">
            Koşullar
          </Link>
          <Link href="/legal/kvkk" className="hover:text-[#c4a8f0]">
            KVKK
          </Link>
          <Link href="/legal/cookies" className="hover:text-[#c4a8f0]">
            Çerezler
          </Link>
          <Link href="/legal/community" className="hover:text-[#c4a8f0]">
            Topluluk
          </Link>
        </nav>
      </header>
      <article className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-[#c4a8f0]">{title}</h1>
          <p className="text-sm text-[#6272a4]">Son güncelleme: {updated}</p>
        </div>
        <div className="space-y-6 text-[#9a95b0] leading-relaxed text-[15px] [&_h2]:text-[#f8f8f2] [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-[#f8f8f2]">
          {children}
        </div>
        <p className="pt-8 border-t border-[#44475a]/40 text-sm text-[#6272a4]">
          Sorularınız için: <a className="text-[#bd93f9] hover:underline" href="mailto:legal@dracord.com.tr">legal@dracord.com.tr</a>
        </p>
      </article>
    </div>
  );
}
