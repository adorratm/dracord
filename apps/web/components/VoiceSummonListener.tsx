'use client';

import { VoiceSummonPrompt } from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useVoiceSession } from '@/components/VoiceSessionProvider';

/** Bir yönetici seni sesli kanala çağırdı → Katıl derse odaya gir */
export function VoiceSummonListener() {
  const { user, client } = useAuth();
  const voice = useVoiceSession();
  const router = useRouter();
  if (!user) return null;
  return (
    <VoiceSummonPrompt
      client={client}
      onAccept={(p) => {
        void voice.join(p.channelId, p.guildId).then(() => router.push(`/channels/${p.guildId}/${p.channelId}`));
      }}
    />
  );
}
