import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;

/** Prod varsayılan; lokal için `EXPO_PUBLIC_API_URL=http://localhost:4000` */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  extra?.apiUrl ||
  'https://api.dracord.com.tr'
).replace(/\/$/, '');
