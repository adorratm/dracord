'use client';

import { cn } from '../lib/cn';

export interface LogoProps {
  className?: string;
  size?: number;
  showBackground?: boolean;
}

export function Logo({ className, size = 32, showBackground = false }: LogoProps) {
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
      {showBackground && <rect width="128" height="128" rx="28" fill="#bd93f9" />}
      <g fill={showBackground ? '#1e1f29' : '#bd93f9'}>
        <path d="M99.5 35.8c-7.3-3.4-15.2-5.9-23.4-7.3-.3.6-.6 1.3-.9 2-8.3-1.2-16.6-1.2-24.8 0-.3-.7-.6-1.4-.9-2-8.3 1.4-16.1 3.9-23.4 7.3C11.5 57.6 7.4 78.8 9.5 99.7c9.7 7.2 19.1 11.5 28.3 14.4 2.3-3.1 4.3-6.5 6-10.1-3.4-1.3-6.6-3-9.5-5.1.8-.6 1.6-1.2 2.4-1.8 18.6 8.6 38.8 8.6 57.2 0 .8.6 1.6 1.2 2.4 1.8-2.9 2.1-6.1 3.8-9.5 5.1 1.7 3.6 3.7 7 6 10.1 9.2-2.9 18.6-7.3 28.3-14.4 2.5-24.2-4.2-45-18.7-63.9zm-55.2 46.2c-5.4 0-9.9-5-9.9-11.1s4.3-11.1 9.9-11.1c5.6 0 10.1 5 10 11.1 0 6.1-4.4 11.1-10 11.1zm39.4 0c-5.4 0-9.9-5-9.9-11.1s4.3-11.1 9.9-11.1c5.6 0 10.1 5 10 11.1 0 6.1-4.4 11.1-10 11.1z" />
        <polygon points="56,76 60,84 64,76" fill="#ff79c6" />
        <polygon points="64,76 68,84 72,76" fill="#ff79c6" />
      </g>
    </svg>
  );
}
