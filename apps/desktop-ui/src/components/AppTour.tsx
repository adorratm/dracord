import { AppTour as SharedAppTour } from '@dracord/ui';
import { useAuth } from '../auth';

/** İlk kullanım turu — ortak bileşen @dracord/ui'da */
export function AppTour() {
  const { user, ready } = useAuth();
  return <SharedAppTour user={user} ready={ready} startDelayMs={800} />;
}
