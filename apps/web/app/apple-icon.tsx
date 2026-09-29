import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1e1e2e',
          borderRadius: 40,
        }}
      >
        <svg width="150" height="150" viewBox="0 0 128 128">
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
    ),
    { ...size },
  );
}
