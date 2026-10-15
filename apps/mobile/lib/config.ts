import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as
  | { apiUrl?: string; webUrl?: string }
  | undefined;

/** Prod varsayılan; lokal için `EXPO_PUBLIC_API_URL=http://localhost:4000` */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  extra?.apiUrl ||
  'https://api.dracord.com.tr'
).replace(/\/$/, '');

/** Web oyun gömme (Three.js) — mobil WebView */
export const WEB_URL = (
  process.env.EXPO_PUBLIC_WEB_URL ||
  extra?.webUrl ||
  'https://dracord.com.tr'
).replace(/\/$/, '');
