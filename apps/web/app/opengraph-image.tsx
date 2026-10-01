import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Dracord — Dracula temalı topluluk sohbeti';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function resolveLogoPng(): string {
  const candidates = [
    join(process.cwd(), 'public', 'logo.png'),
    join(process.cwd(), 'apps', 'web', 'public', 'logo.png'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`logo.png bulunamadı (cwd=${process.cwd()})`);
  }
  return found;
}

export default async function OpenGraphImage() {
  const logoBytes = await readFile(resolveLogoPng());
  const logoSrc = Uint8Array.from(logoBytes).buffer;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '64px 72px',
          gap: 56,
          background: 'linear-gradient(145deg, #13111c 0%, #1a1528 55%, #0b0e18 100%)',
          color: '#f8f8f2',
          fontFamily: 'sans-serif',
        }}
      >
        <img
          src={logoSrc}
          width={320}
          height={320}
          alt="Draco"
          style={{
            borderRadius: 64,
            boxShadow: '0 0 0 8px rgba(189,147,249,0.25)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              letterSpacing: 6,
              color: '#50fa7b',
              fontWeight: 800,
            }}
          >
            DRACULA TEMALI SOHBET
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 18,
              fontSize: 72,
              fontWeight: 900,
              letterSpacing: 4,
            }}
          >
            <span style={{ color: '#bd93f9' }}>DR</span>
            <span style={{ color: '#50fa7b' }}>ACO</span>
            <span style={{ color: '#bd93f9' }}>RD</span>
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 16,
              fontSize: 30,
              color: '#c4a8f0',
              maxWidth: 640,
              lineHeight: 1.35,
            }}
          >
            Metin, ses, müzik botu ve roller — topluluğun için yeni bir zindan.
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 22, color: '#9a95b0' }}>
            dracord.com.tr
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
