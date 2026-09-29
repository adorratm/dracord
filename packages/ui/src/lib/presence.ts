import type { PresenceStatus } from '@dracord/types';

export function presenceDotClass(status: PresenceStatus): string {
  switch (status) {
    case 'ONLINE':
      return 'bg-dracula-green';
    case 'IDLE':
      return 'bg-dracula-orange';
    case 'DND':
      return 'bg-dracula-red';
    case 'OFFLINE':
    default:
      return 'bg-outline';
  }
}

export function presenceLabelTr(status: PresenceStatus): string {
  switch (status) {
    case 'ONLINE':
      return 'Çevrimiçi';
    case 'IDLE':
      return 'Boşta';
    case 'DND':
      return 'Rahatsız etmeyin';
    case 'OFFLINE':
    default:
      return 'Çevrimdışı';
  }
}
