const { synthesizeDealerTts } = require('./dealer-tts');
const fs = require('fs');

synthesizeDealerTts('Merhaba, blackjack masasına hoş geldin')
  .then((r) => {
    console.log(JSON.stringify({ ok: r.ok, voice: r.voice, error: r.error, len: r.base64?.length }));
    if (r.ok) {
      fs.writeFileSync(__dirname + '/tts-smoke.mp3', Buffer.from(r.base64, 'base64'));
      console.log('wrote tts-smoke.mp3', fs.statSync(__dirname + '/tts-smoke.mp3').size);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
