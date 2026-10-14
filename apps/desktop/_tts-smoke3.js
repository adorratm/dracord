const fs = require('fs');
const { EdgeTTS } = require('edge-tts-universal');

async function main() {
  console.log('start');
  const tts = new EdgeTTS('Merhaba test', 'tr-TR-EmelNeural');
  console.log('created');
  const r = await tts.synthesize();
  console.log('keys', r && Object.keys(r));
  const a = r.audio;
  const buf = Buffer.from(a);
  fs.writeFileSync(__dirname + '/tts-smoke.mp3', buf);
  console.log('ok', buf.length);
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exitCode = 1;
});
