import { NextRequest, NextResponse } from 'next/server';
import {
  synthesizeAzureEmel,
  synthesizeEmelNeural,
  synthesizeGoogleTr,
} from '@/lib/edge-emel-tts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LEN = 180;

/** Kurpiyer TTS — Microsoft Azure Emel Neural (tr-TR-EmelNeural) */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q || q.length > MAX_LEN) {
    return NextResponse.json({ error: 'Geçersiz metin' }, { status: 400 });
  }

  try {
    // 1) Resmi Azure anahtarı varsa
    let buf = await synthesizeAzureEmel(q);
    let voice = 'tr-TR-EmelNeural';
    // 2) Edge Read Aloud → aynı Emel Neural sesi
    if (!buf) buf = await synthesizeEmelNeural(q);
    // 3) Google TR (Edge/Azure yokken)
    if (!buf) {
      buf = await synthesizeGoogleTr(q);
      voice = 'google-tr';
    }

    if (!buf?.byteLength || buf.byteLength < 64) {
      return NextResponse.json({ error: 'TTS alınamadı' }, { status: 502 });
    }

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Dealer-Voice': voice,
      },
    });
  } catch {
    return NextResponse.json({ error: 'TTS hatası' }, { status: 502 });
  }
}
