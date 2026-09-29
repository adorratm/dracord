import { DracordClient } from '@dracord/sdk';

let singleton: DracordClient | null = null;

export function getDracordClient(): DracordClient {
  if (!singleton) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    singleton = new DracordClient(baseUrl);
  }
  return singleton;
}
