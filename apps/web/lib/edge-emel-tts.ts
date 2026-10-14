/**
 * Microsoft Azure Emel Neural (tr-TR-EmelNeural).
 * Öncelik: resmi Azure Speech key → Edge Read Aloud (aynı neural ses).
 */

import { Communicate } from 'edge-tts-universal';

export const EMEL_VOICE_NAME = 'tr-TR-EmelNeural';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Edge stream bazen kapanmaz / boş döner — idle + hard timeout ile topla */
async function collectEmelMp3(text: string): Promise<Buffer | null> {
  const communicate = new Communicate(text, {
    voice: EMEL_VOICE_NAME,
    rate: '+0%',
    volume: '+0%',
    pitch: '+0Hz',
  });
  const parts: Buffer[] = [];

  await new Promise<void>((resolve) => {
    let settled = false;
    let idle: ReturnType<typeof setTimeout> | null = null;
    const done = () => {
      if (settled) return;
      settled = true;
      if (idle) clearTimeout(idle);
      clearTimeout(hard);
      resolve();
    };
    const hard = setTimeout(done, 12_000);
    const bumpIdle = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(done, 700);
    };

    void (async () => {
      try {
        for await (const chunk of communicate.stream()) {
          if (settled) break;
          if (chunk.type === 'audio' && chunk.data) {
            parts.push(Buffer.from(chunk.data));
            bumpIdle();
          }
        }
      } catch (err) {
        console.warn('[dealer-tts] Edge stream hata', err);
      } finally {
        done();
      }
    })();
  });

  if (!parts.length) return null;
  const buf = Buffer.concat(parts);
  return buf.byteLength > 64 ? buf : null;
}

/** Edge Read Aloud → tr-TR-EmelNeural MP3 (birkaç deneme) */
export async function synthesizeEmelNeural(text: string): Promise<Buffer | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const buf = await collectEmelMp3(trimmed);
      if (buf) return buf;
    } catch (err) {
      console.warn(`[dealer-tts] Edge Emel deneme ${attempt + 1}`, err);
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 350 + attempt * 250));
    }
  }
  return null;
}

/** Edge/Azure yokken Türkçe ses (kısa satırlar) */
export async function synthesizeGoogleTr(text: string): Promise<Buffer | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const q = encodeURIComponent(trimmed.slice(0, 180));
  const urls = [
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=tr&q=${q}`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=tr&q=${q}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9',
          Referer: 'https://translate.google.com/',
        },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 64) return buf;
    } catch (err) {
      console.warn('[dealer-tts] Google TTS hata', err);
    }
  }
  return null;
}

/** Resmi Azure Speech REST — AZURE_SPEECH_KEY varsa */
export async function synthesizeAzureEmel(text: string): Promise<Buffer | null> {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim() || 'westeurope';
  if (!key) return null;

  const ssml =
    `<speak version='1.0' xml:lang='tr-TR'>` +
    `<voice xml:lang='tr-TR' name='${EMEL_VOICE_NAME}'>${escapeXml(text.trim())}</voice>` +
    `</speak>`;

  try {
    const res = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'dracord-dealer-tts',
        },
        body: ssml,
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 64 ? buf : null;
  } catch {
    return null;
  }
}
