'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Draco } from '@dracord/ui';

/** Draco artık @dracord/ui'da (web + desktop ortak); burada yalnız Next'e özel 404 sayfası kalır. */
export { Draco, DracoEmpty, type DracoMood, type DracoProps, type DracoEmptyProps } from '@dracord/ui';

function DracoWordmark({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${className ?? ''}`}>
      <svg width="36" height="22" viewBox="0 0 36 22" aria-hidden>
        <path
          d="M18 2 L10 14 L14 14 L12 20 L26 8 L20 8 L24 2 Z"
          fill="#bd93f9"
        />
        <ellipse cx="14" cy="8" rx="2" ry="2.5" fill="#50fa7b" />
        <ellipse cx="22" cy="8" rx="2" ry="2.5" fill="#50fa7b" />
      </svg>
      <p className="text-2xl md:text-3xl font-black tracking-[0.18em]">
        <span className="text-[#bd93f9]">DR</span>
        <span className="text-[#50fa7b]">ACO</span>
        <span className="text-[#bd93f9]">RD</span>
      </p>
    </div>
  );
}

function ServerRack({ side }: { side: 'left' | 'right' }) {
  const broken = side === 'left';
  return (
    <div
      className={`absolute bottom-6 ${side === 'left' ? 'left-2 md:left-6' : 'right-2 md:right-6'} opacity-70`}
      aria-hidden
    >
      <svg width="72" height="110" viewBox="0 0 72 110" fill="none">
        <rect
          x="8"
          y="8"
          width="56"
          height="94"
          rx="6"
          stroke="#bd93f9"
          strokeWidth="2"
          opacity="0.7"
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect
              x="16"
              y={18 + i * 16}
              width="40"
              height="10"
              rx="2"
              stroke="#bd93f9"
              strokeWidth="1.5"
              opacity={broken && i === 2 ? 0.35 : 0.55}
            />
            <circle
              cx="48"
              cy={23 + i * 16}
              r="2"
              fill={i % 2 === 0 ? '#50fa7b' : '#ff79c6'}
              opacity={broken && i === 2 ? 0.3 : 0.9}
            />
          </g>
        ))}
        {broken && (
          <>
            <path
              d="M36 58 Q28 72 22 88"
              stroke="#6272a4"
              strokeWidth="2"
              strokeDasharray="3 2"
            />
            <rect x="16" y="86" width="10" height="6" rx="1" fill="#ffb86c" />
          </>
        )}
      </svg>
    </div>
  );
}

/** Tam sayfa 404 — referans mockup */
export function Draco404Page() {
  return (
    <div className="min-h-screen bg-[#1a1528] text-[#f8f8f2] flex flex-col items-center justify-center p-4 md:p-8 select-none overflow-hidden relative">
      {/* Arka plan sohbet balonları */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.12]" aria-hidden>
        <svg className="absolute top-16 left-[8%] w-24 h-16" viewBox="0 0 80 50">
          <path d="M8 8h52a8 8 0 018 8v14a8 8 0 01-8 8H28l-12 10v-10H8a8 8 0 01-8-8V16a8 8 0 018-8z" stroke="#bd93f9" strokeWidth="2" fill="none" />
        </svg>
        <svg className="absolute bottom-24 right-[10%] w-28 h-18" viewBox="0 0 90 55">
          <path d="M10 6h60a10 10 0 0110 10v16a10 10 0 01-10 10H40l-14 12V42H10A10 10 0 010 32V16A10 10 0 0110 6z" stroke="#bd93f9" strokeWidth="2" fill="none" />
        </svg>
      </div>

      <div className="relative w-full max-w-3xl bg-[#231b36]/90 backdrop-blur-xl border border-[#44475a]/80 rounded-2xl p-6 md:p-10 shadow-2xl flex flex-col items-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-[#bd93f9]/10 rounded-full blur-3xl pointer-events-none" />

        <DracoWordmark className="relative z-10 mb-2" />

        <div className="relative w-full max-w-xl h-64 md:h-72 flex items-center justify-center mt-2">
          <ServerRack side="left" />
          <ServerRack side="right" />

          {/* Neon 404 tabela */}
          <motion.div
            animate={{ scale: [1, 1.04, 1], opacity: [0.9, 1, 0.9] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1 right-8 md:right-16 bg-[#1e1e2e] border-2 border-[#50fa7b] rounded-xl px-4 py-1 shadow-[0_0_18px_rgba(80,250,123,0.45)] z-20"
          >
            <span className="text-xl md:text-2xl font-black text-[#50fa7b] tracking-widest drop-shadow-[0_0_8px_rgba(80,250,123,0.85)]">
              404
            </span>
          </motion.div>

          {/* Konuşma balonu */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="absolute top-2 left-6 md:left-14 bg-[#3d3454] text-[#f8f8f2] text-xs font-semibold px-3 py-1.5 rounded-xl rounded-bl-none shadow-md z-20 border border-[#6272a4]"
          >
            Hmm? Bağlantı koptu!
          </motion.div>

          {/* Uçan Draco (aura) */}
          <div className="absolute left-4 md:left-10 bottom-10 scale-75 md:scale-90 origin-bottom">
            <Draco size={120} mood="float" glow />
          </div>

          {/* Endişeli Draco + kablo */}
          <div className="relative z-10 translate-x-6 md:translate-x-10">
            <Draco size={200} mood="confused" showCable glow={false} />
          </div>
        </div>

        <div className="text-center mt-4 z-10 space-y-2">
          <h1 className="text-2xl md:text-4xl font-extrabold text-[#c4a8f0] tracking-wide uppercase">
            404 — Kanal bulunamadı
          </h1>
          <p className="text-[#b8b4c8] text-sm md:text-base max-w-md mx-auto">
            Görünüşe göre Draco bir şeyi koparmış… Aradığın kanal veya sunucu derin zindanlarda kayboldu.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-8 py-3 rounded-full font-bold text-[#1e1e2e] bg-gradient-to-r from-[#ff79c6] to-[#bd93f9] shadow-[0_0_22px_rgba(255,121,198,0.45)] hover:shadow-[0_0_28px_rgba(189,147,249,0.55)] transition-all active:scale-95"
            >
              Sohbete dön
            </button>
            <Link
              href="/channels/@me"
              className="px-6 py-3 rounded-full font-bold text-[#f8f8f2] bg-[#44475a]/80 hover:bg-[#6272a4] transition-all active:scale-95"
            >
              Ana sayfa
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Draco404Maskot = Draco404Page;
