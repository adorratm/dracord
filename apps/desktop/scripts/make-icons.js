/**
 * logo.png → build/icon.png + build/icon.ico (Windows taskbar / installer)
 */
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default || require('png-to-ico');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');
const srcCandidates = [
  path.join(root, '..', 'web', 'public', 'logo.png'),
  path.join(root, '..', 'mobile', 'assets', 'icon.png'),
  path.join(buildDir, 'icon.png'),
];

const src = srcCandidates.find((p) => fs.existsSync(p));
if (!src) {
  console.error('Kaynak logo bulunamadı');
  process.exit(1);
}

fs.mkdirSync(buildDir, { recursive: true });
const pngOut = path.join(buildDir, 'icon.png');
const icoOut = path.join(buildDir, 'icon.ico');

fs.copyFileSync(src, pngOut);

void pngToIco(pngOut)
  .then((buf) => {
    fs.writeFileSync(icoOut, buf);
    console.log('OK:', pngOut);
    console.log('OK:', icoOut);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
