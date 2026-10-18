import { Linking } from 'react-native';
import { isSpotifyUrl, toSpotifyAppUri, toSpotifyWebUrl } from '@dracord/types';

/**
 * Spotify: uygulama URI → yoksa / açılamazsa HTTPS.
 * Diğer URL’ler: Linking.openURL.
 */
export async function openActivityUrl(url: string): Promise<void> {
  const raw = url.trim();
  if (!raw) return;

  if (!isSpotifyUrl(raw)) {
    await Linking.openURL(raw).catch(() => undefined);
    return;
  }

  const appUri = toSpotifyAppUri(raw);
  const webUrl = toSpotifyWebUrl(raw);

  if (appUri) {
    try {
      const can = await Linking.canOpenURL(appUri);
      if (can) {
        await Linking.openURL(appUri);
        return;
      }
    } catch {
      // canOpenURL iOS’ta scheme listelenmemişse false döner — yine dene
      try {
        await Linking.openURL(appUri);
        return;
      } catch {
        /* web’e düş */
      }
    }
  }

  await Linking.openURL(webUrl).catch(() => undefined);
}
