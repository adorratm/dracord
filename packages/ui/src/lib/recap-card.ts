import type { YearRecapDto } from '@dracord/types';

const nf = new Intl.NumberFormat('tr-TR');
export const recapHours = (m: number) => (m >= 120 ? `${nf.format(Math.round(m / 60))} saat` : `${nf.format(m)} dk`);
export const RECAP_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** Paylaşılabilir özet kartı (1080×1350 PNG) — tarayıcı / Electron canvas'ı ile, sunucuya hiçbir şey gitmez. */
export async function renderRecapCard(r: YearRecapDto, name: string): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1b0f3a');
  bg.addColorStop(0.55, '#4a1d7a');
  bg.addColorStop(1, '#d9467a');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // soft orbs
  for (const [x, y, rad, col] of [
    [880, 220, 320, 'rgba(255,200,120,0.18)'],
    [160, 1120, 380, 'rgba(120,200,255,0.16)'],
  ] as const) {
    const o = g.createRadialGradient(x, y, 0, x, y, rad);
    o.addColorStop(0, col);
    o.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = o;
    g.fillRect(0, 0, W, H);
  }
  const font = (w: number, s: number) => `${w} ${s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  g.fillStyle = '#ffffff';
  g.font = font(800, 44);
  g.fillText('DRACORD', 80, 120);
  g.font = font(500, 40);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillText(`${r.year} yıl özeti`, 80, 175);
  g.font = font(800, 72);
  g.fillStyle = '#ffffff';
  g.fillText(name.slice(0, 22), 80, 300);
  g.font = font(400, 120);
  g.fillText(r.persona.emoji, 80, 470);
  g.font = font(800, 64);
  g.fillText(r.persona.title, 230, 440);
  g.font = font(400, 34);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  wrap(g, r.persona.desc, 230, 490, 760, 44);
  const stats: [string, string][] = [
    [nf.format(r.messages), 'mesaj'],
    [recapHours(r.voiceMinutes), 'seste'],
    [nf.format(r.activeDays), 'aktif gün'],
    [nf.format(r.longestStreak), 'gün en uzun seri'],
  ];
  stats.forEach(([v, l], i) => {
    const x = 80 + (i % 2) * 470;
    const y = 640 + Math.floor(i / 2) * 190;
    g.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(g, x, y, 440, 160, 28);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = font(800, 64);
    g.fillText(v, x + 32, y + 82);
    g.font = font(500, 30);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText(l, x + 32, y + 130);
  });
  let y = 1060;
  g.font = font(600, 34);
  g.fillStyle = '#ffffff';
  if (r.topGuilds[0]) {
    g.fillText(`🏠 ${r.topGuilds[0].name}`.slice(0, 40), 80, y);
    y += 56;
  }
  if (r.topEmojis.length) {
    g.fillText(`Favori tepkiler  ${r.topEmojis.map((e) => e.emoji).join(' ')}`, 80, y);
    y += 56;
  }
  if (r.games.played) g.fillText(`🎮 ${nf.format(r.games.played)} oyun · ${nf.format(r.games.won)} galibiyet`, 80, y);
  g.font = font(500, 28);
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillText('dracord.com.tr', 80, H - 70);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > max && line) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = t;
  }
  if (line) g.fillText(line, x, y);
}

/** Paylaş (Web Share API dosya desteği varsa) ya da indir. */
export async function shareRecapCard(blob: Blob, year: number): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], `dracord-${year}-ozet.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `Dracord ${year} özetim` });
      return 'shared';
    } catch {
      /* iptal → indir */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
