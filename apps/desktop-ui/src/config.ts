/** Prod varsayılan; lokal için `VITE_API_URL=http://localhost:4000` */
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://api.dracord.com.tr';
