import { ImageResponse } from 'next/og';

export const runtime = 'edge';
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
          justifyContent: 'center',
          padding: 72,
          background: 'linear-gradient(145deg, #13111c 0%, #1a1528 55%, #0b0e18 100%)',
          color: '#f8f8f2',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, letterSpacing: 6, color: '#50fa7b', fontWeight: 800 }}>
          DRACULA TEMALI SOHBET
        </div>
        <div style={{ display: 'flex', marginTop: 20, fontSize: 72, fontWeight: 900, letterSpacing: 4 }}>
          <span style={{ color: '#bd93f9' }}>DR</span>
          <span style={{ color: '#50fa7b' }}>ACO</span>
          <span style={{ color: '#bd93f9' }}>RD</span>
        </div>
        <div style={{ display: 'flex', marginTop: 16, fontSize: 32, color: '#c4a8f0', maxWidth: 900 }}>
          Metin, ses, müzik botu ve roller — topluluğun için yeni bir zindan.
        </div>
        <div style={{ display: 'flex', marginTop: 36, fontSize: 22, color: '#9a95b0' }}>
          dracord.com.tr
        </div>
      </div>
    ),
    { ...size },
  );
}
