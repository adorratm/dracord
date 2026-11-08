/** Mobil çeviri — cihaz üstü tarayıcı API'si mobilde yok; Google Çeviri uygulaması/sayfası açılır (maliyet yok). */
export function preferredTranslateTarget(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || 'tr';
    return (loc.split('-')[0] || 'tr').toLowerCase();
  } catch {
    return 'tr';
  }
}

export function externalTranslateUrl(text: string, target = preferredTranslateTarget()): string {
  // RN URLSearchParams kısmi — elle kodla
  const e = encodeURIComponent;
  return `https://translate.google.com/?sl=auto&tl=${e(target)}&op=translate&text=${e(text.slice(0, 4500))}`;
}
