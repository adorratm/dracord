const fs = require('fs');
const { EdgeTTS } = require('edge-tts-universal');

async function main() {
  console.log('start');
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const tts = new EdgeTTS('Merhaba test', 'tr-TR-EmelNeural');
    console.log('created');
    const r = await Promise.race([
      tts.synthesize(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 25s')), 25000)),
    ]);
    console.log('keys', r && Object.keys(r));
    const buf = Buffer.from(r.audio);
    fs.writeFileSync(__dirname + '/tts-smoke.mp3', buf);
    console.log('ok', buf.length);
  } finally {
    clearInterval(keepAlive);
  }
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exitCode = 1;
});
