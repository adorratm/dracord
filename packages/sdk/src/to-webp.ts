/**
 * Tarayıcıda görselleri WebP’ye çevirir.
 * GIF ve SVG olduğu gibi kalır.
 */

const WEBP_QUALITY = 0.85;

function isGif(file: File): boolean {
  if (file.type === 'image/gif') return true;
  return /\.gif$/i.test(file.name);
}

function isSvg(file: File): boolean {
  if (file.type === 'image/svg+xml') return true;
  return /\.svg$/i.test(file.name);
}

function isAlreadyWebp(file: File): boolean {
  if (file.type === 'image/webp') return true;
  return /\.webp$/i.test(file.name);
}

function replaceExtWithWebp(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.webp`;
}

function canvasToWebpBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/webp', quality });
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('WebP dönüşümü başarısız'))),
      'image/webp',
      quality,
    );
  });
}

/**
 * image/* (GIF/SVG hariç) → WebP File.
 * Dönüşüm desteklenmezse veya başarısız olursa orijinal dosyayı döner.
 */
export async function ensureWebpUpload(file: File): Promise<File> {
  if (typeof window === 'undefined') return file;
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|bmp|tiff?|avif|webp)$/i.test(file.name)) {
    return file;
  }
  if (isGif(file) || isSvg(file)) return file;
  if (isAlreadyWebp(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const w = bitmap.width;
      const h = bitmap.height;
      if (w < 1 || h < 1) return file;

      let blob: Blob;
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.drawImage(bitmap, 0, 0);
        blob = await canvasToWebpBlob(canvas, WEBP_QUALITY);
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.drawImage(bitmap, 0, 0);
        blob = await canvasToWebpBlob(canvas, WEBP_QUALITY);
      }

      if (!blob.size || blob.type !== 'image/webp') {
        // Tarayıcı webp encode etmiyorsa (eski Safari vb.)
        return file;
      }

      return new File([blob], replaceExtWithWebp(file.name), {
        type: 'image/webp',
        lastModified: Date.now(),
      });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
