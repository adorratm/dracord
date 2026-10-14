const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, 'tts-test-out.txt');

async function main() {
  fs.writeFileSync(out, 'start\n');
  const { Communicate } = require('edge-tts-universal');
  fs.appendFileSync(out, 'loaded\n');
  const c = new Communicate('Merhaba', { voice: 'tr-TR-EmelNeural' });
  let n = 0;
  for await (const ch of c.stream()) {
    if (ch.type === 'audio' && ch.data) {
      n += Buffer.from(ch.data).byteLength;
    }
  }
  fs.appendFileSync(out, `bytes ${n}\n`);
  console.log('bytes', n);
}

main().catch((e) => {
  fs.appendFileSync(out, String(e) + '\n');
  console.error(e);
  process.exit(1);
});
