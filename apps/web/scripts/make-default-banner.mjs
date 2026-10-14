import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const logoPath = path.join(publicDir, 'logo.png');
const outJpg = path.join(publicDir, 'guild-banner-default.jpg');
const outWebp = path.join(publicDir, 'guild-banner-default.webp');

const W = 960;
const H = 270;

const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#11131e"/>
      <stop offset="45%" stop-color="#1e1638"/>
      <stop offset="100%" stop-color="#2d1b4e"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#bd93f9" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#11131e" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
</svg>
`);

const logoSize = 168;
const logo = await sharp(logoPath)
  .resize(logoSize, logoSize, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const base = sharp(bg).composite([
  {
    input: logo,
    left: Math.round((W - logoSize) / 2),
    top: Math.round((H - logoSize) / 2) - 4,
  },
]);

await base.clone().jpeg({ quality: 88, mozjpeg: true }).toFile(outJpg);
await base.webp({ quality: 86 }).toFile(outWebp);
console.log('OK', outJpg, outWebp);
