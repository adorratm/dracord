'use client';

import { cn } from '../lib/cn';

export interface LogoProps {
  className?: string;
  size?: number;
  /** Yuvarlatılmış koyu kare zemin (uygulama ikonu) */
  showBackground?: boolean;
}

/**
 * Draco markası — maskotun (chibi yarasa) ikon kırpımı.
 * viewBox 128; karakter Draco.tsx ile aynı oran/renkler.
 */
export function Logo({ className, size = 32, showBackground = true }: LogoProps) {
  const uid = `logo-${size}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-label="Dracord"
      role="img"
    >
      <defs>
        <radialGradient id={`${uid}-body`} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#e8dcff" />
          <stop offset="50%" stopColor="#c4a8f0" />
          <stop offset="100%" stopColor="#9b7fd4" />
        </radialGradient>
        <radialGradient id={`${uid}-eye`} cx="35%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#8affb0" />
          <stop offset="100%" stopColor="#50fa7b" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <rect width="128" height="128" rx="28" />
        </clipPath>
      </defs>

      <g clipPath={showBackground ? `url(#${uid}-clip)` : undefined}>
        {showBackground && (
          <>
            <rect width="128" height="128" rx="28" fill="#1e1e2e" />
            <circle cx="64" cy="72" r="48" fill="#bd93f9" opacity="0.18" />
          </>
        )}

        {/* Sol kanat */}
        <path
          d="M38 78 C12 52, 2 78, 14 98 C26 90, 32 94, 40 86 Z"
          fill="#6b4fa0"
        />
        <path d="M38 78 C22 62, 10 78, 18 92 Z" fill="#ff79c6" opacity="0.65" />

        {/* Sağ kanat */}
        <path
          d="M90 78 C116 52, 126 78, 114 98 C102 90, 96 94, 88 86 Z"
          fill="#6b4fa0"
        />
        <path d="M90 78 C106 62, 118 78, 110 92 Z" fill="#ff79c6" opacity="0.65" />

        {/* Kuyruk ucu (sağ alt) */}
        <path
          d="M72 108 Q88 116 90 126 Q86 130 82 126 L78 118"
          stroke="#9b7fd4"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M88 128 L98 124 L92 116 Z" fill="#ff79c6" />

        {/* Pelerin */}
        <path
          d="M34 88 C44 74, 84 74, 94 88 C100 98, 96 116, 82 122 C72 128, 56 128, 46 122 C32 116, 28 98, 34 88 Z"
          fill="#3d2a5c"
        />
        <path d="M40 82 L48 96 L44 112 Z" fill="#2a1c42" />
        <path d="M88 82 L80 96 L84 112 Z" fill="#2a1c42" />
        <circle cx="64" cy="96" r="4.5" fill="#ff79c6" />
        <circle cx="63" cy="94.5" r="1.4" fill="#ffd6ee" />

        {/* Gövde */}
        <ellipse cx="64" cy="98" rx="22" ry="18" fill={`url(#${uid}-body)`} />

        {/* Kafa */}
        <circle cx="64" cy="58" r="32" fill={`url(#${uid}-body)`} />

        {/* Saç / widow's peak */}
        <path
          d="M40 36 C48 20, 58 16, 64 28 C70 16, 80 20, 88 36 C80 26, 72 30, 64 40 C56 30, 48 26, 40 36 Z"
          fill="#5a3f8a"
        />
        <path d="M64 24 L70 38 L64 34 L58 38 Z" fill="#5a3f8a" />

        {/* Kulaklar */}
        <path d="M36 46 L22 12 L50 38 Z" fill="#9b7fd4" />
        <path d="M38 44 L28 22 L48 38 Z" fill="#ff79c6" />
        <path d="M92 46 L106 12 L78 38 Z" fill="#9b7fd4" />
        <path d="M90 44 L100 22 L80 38 Z" fill="#ff79c6" />

        {/* Gözler — neon yeşil */}
        <ellipse cx="52" cy="58" rx="8.5" ry="10.5" fill="#1e1e2e" />
        <ellipse cx="52" cy="58" rx="6.5" ry="8.5" fill={`url(#${uid}-eye)`} />
        <circle cx="54.5" cy="54.5" r="2.4" fill="#ffffff" />
        <ellipse cx="76" cy="58" rx="8.5" ry="10.5" fill="#1e1e2e" />
        <ellipse cx="76" cy="58" rx="6.5" ry="8.5" fill={`url(#${uid}-eye)`} />
        <circle cx="78.5" cy="54.5" r="2.4" fill="#ffffff" />

        {/* Yanaklar */}
        <ellipse cx="42" cy="70" rx="5" ry="3" fill="#ff79c6" opacity="0.5" />
        <ellipse cx="86" cy="70" rx="5" ry="3" fill="#ff79c6" opacity="0.5" />

        {/* Gülümseme + vampir dişleri */}
        <path
          d="M55 74 Q64 82 73 74"
          stroke="#2a1f3d"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        <polygon points="57,74 59,80 61,74" fill="#ffffff" />
        <polygon points="67,74 69,80 71,74" fill="#ffffff" />
      </g>
    </svg>
  );
}
