import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'public');
const svgPath = path.join(root, 'logo.svg');
console.log('svg:', svgPath, fs.existsSync(svgPath));

const svg = fs.readFileSync(svgPath);
const logoPng = await sharp(svg).resize(512, 512).png().toBuffer();
fs.writeFileSync(path.join(root, 'logo.png'), logoPng);
console.log('wrote logo.png', logoPng.length);

const logo = await sharp(svg).resize(360, 360).png().toBuffer();
const bg = await sharp({
  create: { width: 1200, height: 630, channels: 3, background: { r: 19, g: 17, b: 28 } },
}).png().toBuffer();

const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <circle cx="260" cy="315" r="200" fill="#bd93f9" opacity="0.12"/>
  <text x="480" y="220" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="800" letter-spacing="6" fill="#50fa7b">DRACULA TEMALI SOHBET</text>
  <text x="480" y="320" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="900" letter-spacing="4">
    <tspan fill="#bd93f9">DR</tspan><tspan fill="#50fa7b">ACO</tspan><tspan fill="#bd93f9">RD</tspan>
  </text>
  <text x="480" y="390" font-family="Arial,Helvetica,sans-serif" font-size="28" fill="#c4a8f0">Metin, ses, müzik botu ve roller</text>
  <text x="480" y="440" font-family="Arial,Helvetica,sans-serif" font-size="28" fill="#c4a8f0">topluluğun için yeni bir zindan.</text>
  <text x="480" y="520" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="#9a95b0">dracord.com.tr</text>
</svg>`);
const textPng = await sharp(text).png().toBuffer();

await sharp(bg)
  .composite([
    { input: logo, left: 80, top: 135 },
    { input: textPng, left: 0, top: 0 },
  ])
  .png()
  .toFile(path.join(root, 'og.png'));

console.log('wrote og.png', fs.statSync(path.join(root, 'og.png')).size);
