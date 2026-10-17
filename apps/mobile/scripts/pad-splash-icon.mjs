import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'assets', 'splash.png');
const outIcon = path.join(root, 'assets', 'splash-icon.png');

const size = 1024;
// Android 12 splash circle diameter ≈ 2/3 of icon. Keep rounded square fully inside.
const logoSize = Math.round(size * 0.55);

const logo = await sharp(src)
  .resize(logoSize, logoSize, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: size,
    height: size,
    channels: 4,
    background: { r: 17, g: 19, b: 30, alpha: 1 },
  },
})
  .composite([{ input: logo, gravity: 'centre' }])
  .png()
  .toFile(outIcon);

const densities = {
  'drawable-mdpi': 1,
  'drawable-hdpi': 1.5,
  'drawable-xhdpi': 2,
  'drawable-xxhdpi': 3,
  'drawable-xxxhdpi': 4,
};

for (const [dir, m] of Object.entries(densities)) {
  const px = Math.round(288 * m);
  const dest = path.join(root, 'android', 'app', 'src', 'main', 'res', dir, 'splashscreen_logo.png');
  await sharp(outIcon).resize(px, px).png().toFile(dest);
  console.log('wrote', dest, px);
}

console.log('ok splash-icon logoSize=', logoSize);
