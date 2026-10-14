import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  synthesizeAzureEmel,
  synthesizeEmelNeural,
  synthesizeGoogleTr,
} from './dealer-tts';

const MAX_LEN = 180;

/** Public — blackjack kurpiyer TTS (desktop + web istemcileri) */
@Controller('dealer-tts')
export class DealerTtsController {
  @Get()
  async speak(@Query('q') q: string | undefined, @Res() res: Response) {
    const text = (q ?? '').trim();
    if (!text || text.length > MAX_LEN) {
      res.status(400).json({ error: 'Geçersiz metin' });
      return;
    }

    try {
      let buf = await synthesizeAzureEmel(text);
      let voice = 'tr-TR-EmelNeural';
      if (!buf) buf = await synthesizeEmelNeural(text);
      if (!buf) {
        buf = await synthesizeGoogleTr(text);
        voice = 'google-tr';
      }

      if (!buf?.byteLength || buf.byteLength < 64) {
        res.status(502).json({ error: 'TTS alınamadı' });
        return;
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.setHeader('X-Dealer-Voice', voice);
      res.status(200).send(buf);
    } catch {
      res.status(502).json({ error: 'TTS hatası' });
    }
  }
}
