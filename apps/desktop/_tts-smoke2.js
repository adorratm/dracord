const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, 'tts-test-out2.txt');

function log(msg) {
  fs.appendFileSync(out, msg + '\n');
  console.log(msg);
}

async function main() {
  fs.writeFileSync(out, '');
  log('start');
  const mod = require('edge-tts-universal');
  log('keys ok');

  // Prefer EdgeTTS simple API if present
  if (typeof mod.EdgeTTS === 'function') {
    log('using EdgeTTS');
    const tts = new mod.EdgeTTS('Merhaba test', { voice: 'tr-TR-EmelNeural' });
    const result = await Promise.race([
      tts.synthesize(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
    ]);
    const audio = result?.audio || result;
    const len = audio
      ? Buffer.isBuffer(audio)
        ? audio.length
        : audio.byteLength || 0
      : 0;
    log('EdgeTTS len ' + len);
    if (len > 64) {
      fs.writeFileSync(path.join(__dirname, 'tts-smoke.mp3'), Buffer.from(audio));
    }
    return;
  }

  log('fallback Communicate');
  const c = new mod.Communicate('Merhaba test', { voice: 'tr-TR-EmelNeural' });
  let n = 0;
  const timer = setTimeout(() => log('still waiting 10s'), 10000);
  for await (const ch of c.stream()) {
    log('chunk ' + ch.type);
    if (ch.type === 'audio' && ch.data) n += Buffer.from(ch.data).byteLength;
  }
  clearTimeout(timer);
  log('bytes ' + n);
}

main()
  .then(() => {
    log('done');
    process.exit(0);
  })
  .catch((e) => {
    log('err ' + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
