import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LEN = 180;

/** Kurpiyer TTS proxy — Google Translate sesi (tr), istemci CORS engelini aşar */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q || q.length > MAX_LEN) {
    return NextResponse.json({ error: 'Geçersiz metin' }, { status: 400 });
  }

  const url =
    `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=tr` +
    `&q=${encodeURIComponent(q)}&textlen=${q.length}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
        Referer: 'https://translate.google.com/',
      },
      cache: 'force-cache',
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: 'TTS alınamadı' }, { status: 502 });
    }

    const buf = await upstream.arrayBuffer();
    if (!buf.byteLength || buf.byteLength < 64) {
      return NextResponse.json({ error: 'Boş ses' }, { status: 502 });
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'TTS hatası' }, { status: 502 });
  }
}
