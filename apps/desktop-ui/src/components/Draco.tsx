/** CSS animasyonlu Draco maskotu (web framer-motion bağımlılığı yok) */
export function Draco({
  size = 160,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      role="img"
      aria-label="Draco maskotu"
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="draco-glow" aria-hidden />
      <div className="draco-float" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <radialGradient id="dracoBodyDesktop" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#e2d4ff" />
              <stop offset="55%" stopColor="#c4a8f0" />
              <stop offset="100%" stopColor="#a78bdb" />
            </radialGradient>
            <radialGradient id="dracoEyeDesktop" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#8affb0" />
              <stop offset="100%" stopColor="#50fa7b" />
            </radialGradient>
          </defs>

          <path
            d="M108 148 Q128 158 132 172 Q128 178 122 172 L118 164"
            stroke="#a78bdb"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M130 176 L142 172 L134 164 Z" fill="#ff79c6" />

          <g className="draco-wing-l">
            <path
              d="M62 108 C28 78, 12 108, 28 132 C42 124, 50 128, 64 118 Z"
              fill="#6b4fa0"
              opacity={0.85}
            />
            <path d="M62 108 C38 88, 22 110, 34 126 Z" fill="#ff79c6" opacity={0.55} />
          </g>
          <g className="draco-wing-r">
            <path
              d="M138 108 C172 78, 188 108, 172 132 C158 124, 150 128, 136 118 Z"
              fill="#6b4fa0"
              opacity={0.85}
            />
            <path d="M138 108 C162 88, 178 110, 166 126 Z" fill="#ff79c6" opacity={0.55} />
          </g>

          <path
            d="M58 118 C70 102, 130 102, 142 118 C148 128, 145 148, 130 155 C115 162, 85 162, 70 155 C55 148, 52 128, 58 118 Z"
            fill="#4a3570"
          />
          <circle cx="100" cy="126" r="5" fill="#ff79c6" />
          <circle cx="99" cy="124.5" r="1.6" fill="#ffd6ee" />

          <ellipse cx="100" cy="128" rx="28" ry="24" fill="url(#dracoBodyDesktop)" />
          <circle cx="100" cy="86" r="42" fill="url(#dracoBodyDesktop)" />

          <path
            d="M68 58 C78 42, 92 38, 100 48 C108 38, 122 42, 132 58 C124 48, 112 52, 100 62 C88 52, 76 48, 68 58 Z"
            fill="#6b4fa0"
          />
          <path d="M100 48 L106 62 L100 58 L94 62 Z" fill="#6b4fa0" />

          <path d="M62 70 L42 28 L78 58 Z" fill="#a78bdb" />
          <path d="M64 66 L50 38 L74 58 Z" fill="#ff79c6" />
          <path d="M138 70 L158 28 L122 58 Z" fill="#a78bdb" />
          <path d="M136 66 L150 38 L126 58 Z" fill="#ff79c6" />

          {/* Headset */}
          <path
            d="M58 86 Q100 58 142 86"
            stroke="#1e2a22"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <rect x="48" y="78" width="14" height="22" rx="4" fill="#1e2a22" />
          <rect x="138" y="78" width="14" height="22" rx="4" fill="#1e2a22" />
          <rect x="50" y="82" width="10" height="6" rx="1" fill="#50fa7b" />

          <g className="draco-blink">
            <ellipse cx="86" cy="86" rx="10" ry="12" fill="#2a1f3d" />
            <ellipse cx="86" cy="86" rx="7.5" ry="10" fill="url(#dracoEyeDesktop)" />
            <circle cx="89" cy="82" r="3" fill="#ffffff" />
            <ellipse cx="114" cy="86" rx="10" ry="12" fill="#2a1f3d" />
            <ellipse cx="114" cy="86" rx="7.5" ry="10" fill="url(#dracoEyeDesktop)" />
            <circle cx="117" cy="82" r="3" fill="#ffffff" />
          </g>

          <ellipse cx="70" cy="98" rx="6" ry="3.5" fill="#ff79c6" opacity={0.45} />
          <ellipse cx="130" cy="98" rx="6" ry="3.5" fill="#ff79c6" opacity={0.45} />

          <path
            d="M92 104 Q100 112 108 104"
            stroke="#2a1f3d"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <polygon points="94,104 96,109 98,104" fill="#ffffff" />
          <polygon points="102,104 104,109 106,104" fill="#ffffff" />

          <g className="draco-wave">
            <ellipse cx="152" cy="100" rx="9" ry="11" fill="url(#dracoBodyDesktop)" />
          </g>
        </svg>
      </div>
    </div>
  );
}
