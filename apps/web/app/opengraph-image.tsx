import { ImageResponse } from 'next/og';

export const alt = 'Dracord — Dracula temalı topluluk sohbeti';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#13111c',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 70% 80% at 85% 40%, rgba(189,147,249,0.35), transparent 55%), radial-gradient(ellipse 50% 50% at 10% 85%, rgba(255,121,198,0.18), transparent 50%), radial-gradient(ellipse 40% 40% at 40% 10%, rgba(80,250,123,0.12), transparent 45%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.08,
            backgroundImage:
              'linear-gradient(rgba(189,147,249,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(189,147,249,0.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '56px 72px',
            gap: 40,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 620 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: '#50fa7b',
                textTransform: 'uppercase',
              }}
            >
              dracord.com.tr
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 78,
                fontWeight: 900,
                letterSpacing: '0.1em',
                lineHeight: 1,
              }}
            >
              <span style={{ color: '#bd93f9' }}>DR</span>
              <span style={{ color: '#50fa7b' }}>ACO</span>
              <span style={{ color: '#bd93f9' }}>RD</span>
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: '#f8f8f2',
                lineHeight: 1.25,
                maxWidth: 560,
              }}
            >
              Topluluğun için yeni bir zindan
            </div>
            <div
              style={{
                fontSize: 24,
                color: '#b8b4c8',
                lineHeight: 1.4,
                maxWidth: 520,
              }}
            >
              Metin · Ses · Roller · Arkadaşlar — Draco ile Dracula temalı sohbet
            </div>
          </div>

          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: 72,
              background: 'rgba(30,30,46,0.85)',
              border: '3px solid #6272a4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 64px rgba(189,147,249,0.4)',
              flexShrink: 0,
            }}
          >
            <svg width="248" height="248" viewBox="0 0 128 128">
              <path d="M38 78 C12 52, 2 78, 14 98 C26 90, 32 94, 40 86 Z" fill="#6b4fa0" />
              <path d="M90 78 C116 52, 126 78, 114 98 C102 90, 96 94, 88 86 Z" fill="#6b4fa0" />
              <path
                d="M34 88 C44 74, 84 74, 94 88 C100 98, 96 116, 82 122 C72 128, 56 128, 46 122 C32 116, 28 98, 34 88 Z"
                fill="#3d2a5c"
              />
              <circle cx="64" cy="96" r="4.5" fill="#ff79c6" />
              <ellipse cx="64" cy="98" rx="22" ry="18" fill="#c4a8f0" />
              <circle cx="64" cy="58" r="32" fill="#c4a8f0" />
              <path
                d="M40 36 C48 20, 58 16, 64 28 C70 16, 80 20, 88 36 C80 26, 72 30, 64 40 C56 30, 48 26, 40 36 Z"
                fill="#5a3f8a"
              />
              <path d="M36 46 L22 12 L50 38 Z" fill="#9b7fd4" />
              <path d="M38 44 L28 22 L48 38 Z" fill="#ff79c6" />
              <path d="M92 46 L106 12 L78 38 Z" fill="#9b7fd4" />
              <path d="M90 44 L100 22 L80 38 Z" fill="#ff79c6" />
              <ellipse cx="52" cy="58" rx="8.5" ry="10.5" fill="#1e1e2e" />
              <ellipse cx="52" cy="58" rx="6.5" ry="8.5" fill="#50fa7b" />
              <circle cx="54.5" cy="54.5" r="2.4" fill="#ffffff" />
              <ellipse cx="76" cy="58" rx="8.5" ry="10.5" fill="#1e1e2e" />
              <ellipse cx="76" cy="58" rx="6.5" ry="8.5" fill="#50fa7b" />
              <circle cx="78.5" cy="54.5" r="2.4" fill="#ffffff" />
              <path
                d="M55 74 Q64 82 73 74"
                stroke="#2a1f3d"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
              <polygon points="57,74 59,80 61,74" fill="#ffffff" />
              <polygon points="67,74 69,80 71,74" fill="#ffffff" />
            </svg>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
