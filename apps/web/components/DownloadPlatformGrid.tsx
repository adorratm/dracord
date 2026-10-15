'use client';

import Link from 'next/link';
import { useCallback, useState, type MouseEvent } from 'react';
import {
  DOWNLOADS,
  WINDOWS_UNSIGNED_STEPS,
  type DownloadItem,
} from '@/lib/downloads';

type Props = {
  /** true: daha sıkı kart stili (/download sayfası) */
  compact?: boolean;
  /** /download sayfasında alt link tekrarını gizle */
  hideFooterLinks?: boolean;
};

export function DownloadPlatformGrid({ compact, hideFooterLinks }: Props) {
  const [pending, setPending] = useState<DownloadItem | null>(null);

  const onPick = useCallback((item: DownloadItem, e: MouseEvent) => {
    if (!item.href) return;
    if (item.warnBeforeDownload === 'windows-unsigned') {
      e.preventDefault();
      setPending(item);
    }
  }, []);

  const confirmDownload = useCallback(() => {
    if (!pending?.href) return;
    const url = pending.href;
    setPending(null);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [pending]);

  return (
    <>
      <div
        className={
          compact
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'
            : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4'
        }
      >
        {DOWNLOADS.map((d) => {
          const live = Boolean(d.href);
          const className =
            'flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#44475a]/50 bg-[#1a1c2c]/80 px-3 py-5 min-h-[112px] transition-all ' +
            (live
              ? 'hover:border-[#bd93f9]/50 hover:-translate-y-0.5 hover:bg-[#1a1c2c] cursor-pointer'
              : 'opacity-80 cursor-default');
          const inner = (
            <>
              <span className="material-symbols-outlined text-[28px] text-[#bd93f9]">
                {d.icon}
              </span>
              <span className="font-bold text-sm text-[#f8f8f2] text-center">{d.label}</span>
              {!live ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6272a4]">
                  Yakında
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#50fa7b]">
                  İndir
                </span>
              )}
            </>
          );
          return live ? (
            <a
              key={d.id}
              href={d.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
              onClick={(e) => onPick(d, e)}
            >
              {inner}
            </a>
          ) : (
            <div key={d.id} className={className} aria-disabled>
              {inner}
            </div>
          );
        })}
      </div>

      {pending ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="windows-unsigned-title"
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#44475a]/60 bg-[#1e1f2e] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#ffb86c] text-[28px]">
                warning
              </span>
              <div>
                <h3
                  id="windows-unsigned-title"
                  className="font-bold text-lg text-[#f8f8f2]"
                >
                  Windows kurulum uyarısı
                </h3>
                <p className="text-sm text-[#9a95b0] mt-1 leading-relaxed">
                  İmzalanmış (Authenticode) bir sürüm henüz yok. İndirmeden önce şu
                  adımları bil:
                </p>
              </div>
            </div>
            <ol className="list-decimal list-inside space-y-2 text-sm text-[#f8f8f2]/90 leading-relaxed">
              {WINDOWS_UNSIGNED_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="text-xs text-[#6272a4] leading-relaxed">
              İleride kod imzalı paket yayınlandığında bu uyarı kalkacak.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="h-11 px-4 rounded-xl font-semibold text-[#f8f8f2] bg-[#44475a]/40 hover:bg-[#44475a]/60"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={confirmDownload}
                className="h-11 px-4 rounded-xl font-bold text-[#1e1e2e] bg-[#50fa7b] hover:bg-[#8affb0]"
              >
                Anladım, indir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!hideFooterLinks ? (
        <p className="mt-8 text-center text-sm text-[#6272a4]">
          Tarayıcıda hemen kullan:{' '}
          <Link href="/login" className="text-[#bd93f9] hover:underline">
            giriş yap
          </Link>
          . Detaylı indirme notları:{' '}
          <Link href="/download" className="text-[#bd93f9] hover:underline">
            /download
          </Link>
        </p>
      ) : null}
    </>
  );
}
