'use client';

export {
  VoiceSessionProvider,
  useVoiceSession,
  type ActiveScreenShare,
} from '@/components/VoiceSessionProvider';

/** @deprecated Prefer useVoiceSession — ses bağlantısı artık navigasyondan bağımsız. */
export { useVoiceSession as useVoiceRoom } from '@/components/VoiceSessionProvider';
