'use client';

import { motion, type Transition } from 'framer-motion';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Draco ruh halleri — referans görseldeki ifadelere yakın */
export type DracoMood =
  | 'idle'
  | 'float'
  | 'wave'
  | 'peek'
  | 'confused'
  | 'happy'
  | 'sleep'
  | 'wink'
  | 'shock'
  | 'power';

export interface DracoProps {
  size?: number;
  mood?: DracoMood;
  /** Kopuk ethernet / kıvılcım (404) */
  showCable?: boolean;
  /** Neon yeşil aura (uçuş) */
  glow?: boolean;
  /** Gaming headset (online) */
  headset?: boolean;
  className?: string;
  'aria-label'?: string;
}

const COLORS = {
  body: '#c4a8f0',
  bodyDark: '#a78bdb',
  hair: '#6b4fa0',
  cape: '#4a3570',
  capeEdge: '#2d2048',
  earInner: '#ff79c6',
  gem: '#ff79c6',
  eye: '#50fa7b',
  eyeGlow: '#8affb0',
  line: '#2a1f3d',
  fang: '#ffffff',
  cheek: '#ff79c6',
} as const;

const bodyMotion: Record<
  DracoMood,
  { animate: Record<string, number | number[]>; transition: Transition }
> = {
  idle: {
    animate: { y: [0, -4, 0], rotate: [0, 1, 0] },
    transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
  },
  float: {
    animate: { y: [-10, 10, -10], rotate: [-2, 2, -2] },
    transition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
  },
  wave: {
    animate: { y: [-4, 4, -4], rotate: [-2, 2, -2] },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  peek: {
    animate: { y: [4, 0, 4], rotate: [-1, 2, -1] },
    transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
  },
  confused: {
    animate: { y: [-5, 5, -5], rotate: [-3, 3, -3] },
    transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
  },
  happy: {
    animate: { y: [0, -10, 0], scale: [1, 1.05, 1] },
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },
  sleep: {
    animate: { y: [0, -2, 0] },
    transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
  },
  wink: {
    animate: { y: [0, -3, 0], rotate: [0, -2, 0] },
    transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
  },
  shock: {
    animate: { y: [0, -6, 0], scale: [1, 1.03, 1] },
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
  power: {
    animate: { y: [-6, 6, -6], scale: [1, 1.04, 1] },
    transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
  },
};

/**
 * Draco — Dracord chibi yarasa maskotu (referans illüstrasyona yakın SVG).
 */
export function Draco({
  size = 160,
  mood = 'float',
  showCable = false,
  glow = false,
  headset = false,
  className,
  'aria-label': ariaLabel = 'Draco maskotu',
}: DracoProps) {
  const motionCfg = bodyMotion[mood];
  const sleeping = mood === 'sleep';
  const powerEyes = mood === 'power';
  const winkLeft = mood === 'wink';
  const shocked = mood === 'shock';
  const thinking = mood === 'peek' || mood === 'confused';
  const waving = mood === 'wave';
  const joyful = mood === 'happy';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className ?? ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      {(glow || mood === 'float' || mood === 'power') && (
        <motion.div
          className="absolute inset-[8%] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(80,250,123,0.45) 0%, rgba(80,250,123,0.08) 55%, transparent 70%)',
          }}
          animate={{ opacity: [0.55, 0.95, 0.55], scale: [0.95, 1.08, 0.95] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
      )}

      <motion.div
        animate={motionCfg.animate}
        transition={motionCfg.transition}
        className="relative z-10"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          <defs>
            <radialGradient id="dracoBody" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#e2d4ff" />
              <stop offset="55%" stopColor={COLORS.body} />
              <stop offset="100%" stopColor={COLORS.bodyDark} />
            </radialGradient>
            <radialGradient id="dracoEye" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor={COLORS.eyeGlow} />
              <stop offset="100%" stopColor={COLORS.eye} />
            </radialGradient>
            <filter id="dracoSoft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" />
            </filter>
          </defs>

          {/* Kuyruk */}
          <path
            d="M108 148 Q128 158 132 172 Q128 178 122 172 L118 164"
            stroke={COLORS.bodyDark}
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M130 176 L142 172 L134 164 Z" fill={COLORS.earInner} />

          {/* Kanatlar (arka) */}
          <motion.path
            d="M62 108 C28 78, 12 108, 28 132 C42 124, 50 128, 64 118 Z"
            fill={COLORS.hair}
            opacity={0.85}
            animate={{ rotate: sleeping ? [0, -2, 0] : [0, -7, 0] }}
            transition={{ duration: sleeping ? 4 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '62px 110px' }}
          />
          <path
            d="M62 108 C38 88, 22 110, 34 126 Z"
            fill={COLORS.earInner}
            opacity={0.55}
          />
          <motion.path
            d="M138 108 C172 78, 188 108, 172 132 C158 124, 150 128, 136 118 Z"
            fill={COLORS.hair}
            opacity={0.85}
            animate={{ rotate: sleeping ? [0, 2, 0] : [0, 7, 0] }}
            transition={{ duration: sleeping ? 4 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '138px 110px' }}
          />
          <path
            d="M138 108 C162 88, 178 110, 166 126 Z"
            fill={COLORS.earInner}
            opacity={0.55}
          />

          {/* Pelerin yakası */}
          <path
            d="M58 118 C70 102, 130 102, 142 118 C148 128, 145 148, 130 155 C115 162, 85 162, 70 155 C55 148, 52 128, 58 118 Z"
            fill={COLORS.cape}
          />
          <path
            d="M68 112 L78 128 L72 148 Z"
            fill={COLORS.capeEdge}
          />
          <path
            d="M132 112 L122 128 L128 148 Z"
            fill={COLORS.capeEdge}
          />
          {/* Pembe mücevher */}
          <circle cx="100" cy="126" r="5" fill={COLORS.gem} />
          <circle cx="99" cy="124.5" r="1.6" fill="#ffd6ee" />

          {/* Gövde */}
          <ellipse cx="100" cy="128" rx="28" ry="24" fill="url(#dracoBody)" />

          {/* Kafa */}
          <circle cx="100" cy="86" r="42" fill="url(#dracoBody)" />

          {/* Saç / widow's peak */}
          <path
            d="M68 58 C78 42, 92 38, 100 48 C108 38, 122 42, 132 58 C124 48, 112 52, 100 62 C88 52, 76 48, 68 58 Z"
            fill={COLORS.hair}
          />
          <path
            d="M100 48 L106 62 L100 58 L94 62 Z"
            fill={COLORS.hair}
          />

          {/* Kulaklar */}
          <path d="M62 70 L42 28 L78 58 Z" fill={COLORS.bodyDark} />
          <path d="M64 66 L50 38 L74 58 Z" fill={COLORS.earInner} />
          <path d="M138 70 L158 28 L122 58 Z" fill={COLORS.bodyDark} />
          <path d="M136 66 L150 38 L126 58 Z" fill={COLORS.earInner} />

          {/* Headset */}
          {headset && (
            <g>
              <path
                d="M58 86 Q100 58 142 86"
                stroke="#1e2a22"
                strokeWidth="7"
                fill="none"
                strokeLinecap="round"
              />
              <rect x="48" y="78" width="14" height="22" rx="4" fill="#1e2a22" />
              <rect x="138" y="78" width="14" height="22" rx="4" fill="#1e2a22" />
              <rect x="50" y="82" width="10" height="6" rx="1" fill={COLORS.eye} />
              <path
                d="M152 92 Q168 108 162 122"
                stroke="#1e2a22"
                strokeWidth="3.5"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="162" cy="124" r="4" fill="#1e2a22" />
              <circle cx="162" cy="124" r="1.5" fill={COLORS.eye} />
            </g>
          )}

          {/* Gözler */}
          {sleeping ? (
            <>
              <path d="M78 86 Q86 90 94 86" stroke={COLORS.line} strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M106 86 Q114 90 122 86" stroke={COLORS.line} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </>
          ) : joyful ? (
            <>
              <path d="M78 88 Q86 80 94 88" stroke={COLORS.line} strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M106 88 Q114 80 122 88" stroke={COLORS.line} strokeWidth="3" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <motion.g
              animate={powerEyes ? { opacity: [0.85, 1, 0.85] } : { scaleY: [1, 0.12, 1] }}
              transition={
                powerEyes
                  ? { duration: 1.2, repeat: Infinity }
                  : { duration: 4, repeat: Infinity, times: [0, 0.96, 1] }
              }
              style={{ transformOrigin: '100px 86px' }}
            >
              {/* Sol */}
              {winkLeft ? (
                <path d="M78 86 Q86 90 94 86" stroke={COLORS.line} strokeWidth="2.5" fill="none" strokeLinecap="round" />
              ) : (
                <>
                  <ellipse cx="86" cy="86" rx={shocked ? 11 : 10} ry={shocked ? 14 : 12} fill={COLORS.line} />
                  <ellipse
                    cx="86"
                    cy="86"
                    rx={shocked ? 8 : 7.5}
                    ry={shocked ? 11 : 10}
                    fill={powerEyes ? COLORS.eye : 'url(#dracoEye)'}
                  />
                  {!powerEyes && <circle cx="89" cy="82" r="3" fill="#ffffff" />}
                  {powerEyes && (
                    <ellipse cx="86" cy="86" rx="9" ry="12" fill={COLORS.eye} opacity="0.5" filter="url(#dracoSoft)" />
                  )}
                </>
              )}
              {/* Sağ */}
              <ellipse cx="114" cy="86" rx={shocked ? 11 : 10} ry={shocked ? 14 : 12} fill={COLORS.line} />
              <ellipse
                cx="114"
                cy="86"
                rx={shocked ? 8 : 7.5}
                ry={shocked ? 11 : 10}
                fill={powerEyes ? COLORS.eye : 'url(#dracoEye)'}
              />
              {!powerEyes && <circle cx="117" cy="82" r="3" fill="#ffffff" />}
            </motion.g>
          )}

          {/* Yanaklar */}
          <ellipse cx="70" cy="98" rx="6" ry="3.5" fill={COLORS.cheek} opacity="0.45" />
          <ellipse cx="130" cy="98" rx="6" ry="3.5" fill={COLORS.cheek} opacity="0.45" />

          {/* Ağız + dişler */}
          {shocked ? (
            <ellipse cx="100" cy="108" rx="7" ry="8" fill={COLORS.line} />
          ) : joyful ? (
            <path d="M88 104 Q100 118 112 104" stroke={COLORS.line} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          ) : thinking ? (
            <path d="M94 106 Q100 110 106 106" stroke={COLORS.line} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          ) : sleeping ? (
            <path d="M94 106 Q100 108 106 106" stroke={COLORS.line} strokeWidth="2" fill="none" strokeLinecap="round" />
          ) : (
            <>
              <path
                d="M92 104 Q100 112 108 104"
                stroke={COLORS.line}
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
              />
              <polygon points="94,104 96,109 98,104" fill={COLORS.fang} />
              <polygon points="102,104 104,109 106,104" fill={COLORS.fang} />
            </>
          )}

          {/* Düşünme eli */}
          {thinking && !showCable && (
            <g>
              <ellipse cx="132" cy="118" rx="10" ry="8" fill="url(#dracoBody)" />
              <path d="M128 112 Q138 108 142 118" stroke={COLORS.bodyDark} strokeWidth="2" fill="none" />
            </g>
          )}

          {/* Dalga eli */}
          {waving && (
            <motion.g
              animate={{ rotate: [-20, 25, -20] }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: '148px 108px' }}
            >
              <ellipse cx="152" cy="100" rx="9" ry="11" fill="url(#dracoBody)" />
              <path d="M148 92 Q156 86 160 94" stroke={COLORS.bodyDark} strokeWidth="2" fill="none" />
            </motion.g>
          )}

          {/* zzz */}
          {sleeping && (
            <motion.text
              x="148"
              y="58"
              fill="#6272a4"
              fontSize="13"
              fontFamily="system-ui,sans-serif"
              fontWeight="700"
              animate={{ opacity: [0.25, 1, 0.25], y: [58, 44, 58] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              zzz
            </motion.text>
          )}

          {/* Eller + kablo (404) */}
          {showCable && (
            <g>
              <ellipse cx="78" cy="138" rx="9" ry="7" fill="url(#dracoBody)" />
              <ellipse cx="122" cy="138" rx="9" ry="7" fill="url(#dracoBody)" />
              {/* Sol kablo parçası */}
              <path
                d="M70 140 Q55 148 42 152"
                stroke="#6272a4"
                strokeWidth="3.5"
                fill="none"
                strokeLinecap="round"
              />
              <rect x="34" y="148" width="12" height="8" rx="1.5" fill="#ffb86c" transform="rotate(-18 40 152)" />
              {/* Sağ kablo */}
              <path
                d="M130 140 Q148 150 162 156"
                stroke="#6272a4"
                strokeWidth="3.5"
                fill="none"
                strokeLinecap="round"
              />
              <rect x="158" y="152" width="12" height="8" rx="1.5" fill="#ffb86c" transform="rotate(22 164 156)" />
              <motion.circle
                cx="48"
                cy="160"
                r="2.5"
                fill="#f1fa8c"
                animate={{ opacity: [0, 1, 0], scale: [0.7, 1.5, 0.7] }}
                transition={{ duration: 0.55, repeat: Infinity }}
              />
              <motion.circle
                cx="172"
                cy="164"
                r="2"
                fill="#f1fa8c"
                animate={{ opacity: [0, 1, 0], scale: [0.7, 1.4, 0.7] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: 0.2 }}
              />
            </g>
          )}
        </svg>
      </motion.div>
    </div>
  );
}

export interface DracoEmptyProps {
  mood?: DracoMood;
  size?: number;
  title?: string;
  description?: string;
  headset?: boolean;
  children?: ReactNode;
  className?: string;
}

export function DracoEmpty({
  mood = 'peek',
  size = 96,
  title,
  description,
  headset,
  children,
  className,
}: DracoEmptyProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-center px-4 py-6 ${className ?? ''}`}
    >
      <Draco size={size} mood={mood} glow headset={headset} />
      {title && <p className="font-headline-md text-on-surface">{title}</p>}
      {description && (
        <p className="font-body-sm text-outline max-w-xs">{description}</p>
      )}
      {children}
    </div>
  );
}

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
