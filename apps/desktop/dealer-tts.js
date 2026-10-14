/**
 * Kurpiyer TTS (main process).
 * 1) Microsoft Edge Emel Neural
 * 2) Google Translate TTS (tr) — Edge/API yokken
 */

const { EdgeTTS } = require('edge-tts-universal');

const EMEL_VOICE = 'tr-TR-EmelNeural';
const MAX_LEN = 180;

/**
 * @param {string} text
 * @param {number} ms
 * @returns {Promise<Buffer | null>}
 */
async function collectEmelMp3(text, ms = 4500) {
  try {
    const tts = new EdgeTTS(text, EMEL_VOICE);
    const result = await Promise.race([
      tts.synthesize(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('edge-timeout')), ms);
      }),
    ]);
    const audio = result?.audio;
    if (!audio) return null;
    const buf = Buffer.from(audio);
    return buf.byteLength > 64 ? buf : null;
  } catch (err) {
    if (err && err.message !== 'edge-timeout') {
      console.warn('[dealer-tts] Edge Emel hata', err.message || err);
    }
    return null;
  }
}

/**
 * @param {string} text
 * @returns {Promise<Buffer | null>}
 */
async function collectGoogleMp3(text) {
  const q = encodeURIComponent(text);
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
          'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
          'Referer': 'https://translate.google.com/',
        },
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 64) return buf;
    } catch (err) {
      console.warn('[dealer-tts] Google TTS hata', err?.message || err);
    }
  }
  return null;
}

/**
 * @param {string} text
 * @returns {Promise<{ ok: true, base64: string, mime: string, voice: string } | { ok: false, error: string }>}
 */
async function synthesizeDealerTts(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed || trimmed.length > MAX_LEN) {
    return { ok: false, error: 'invalid' };
  }

  let buf = await collectEmelMp3(trimmed);
  let voice = 'tr-TR-EmelNeural';
  if (!buf) {
    buf = await collectGoogleMp3(trimmed);
    voice = 'google-tr';
  }

  if (!buf) return { ok: false, error: 'unavailable' };

  return {
    ok: true,
    base64: buf.toString('base64'),
    mime: 'audio/mpeg',
    voice,
  };
}

module.exports = { synthesizeDealerTts };
