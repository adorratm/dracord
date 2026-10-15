import type { DracordClient } from '@dracord/sdk';

type VoiceLike = {
  voiceGuildId: string | null;
  leave: () => void | Promise<void>;
};

/** Ses presence + LiveKit kopar, metin kanalına yönlendir */
export async function leaveVoiceFully(opts: {
  client: DracordClient;
  voice: VoiceLike;
  router: { replace: (href: string) => void };
  guildIdFallback?: string | null;
}): Promise<void> {
  const { client, voice, router, guildIdFallback } = opts;
  const gid = voice.voiceGuildId ?? guildIdFallback ?? null;
  await Promise.resolve(voice.leave()).catch(() => undefined);
  if (!gid) {
    router.replace('/(app)/guilds');
    return;
  }
  try {
    const channels = await client.getGuildChannels(gid);
    const text = channels.find((c) => c.type === 'TEXT');
    if (text) {
      router.replace(`/(app)/channels/${gid}/${text.id}`);
      return;
    }
  } catch {
    /* ignore */
  }
  router.replace('/(app)/guilds');
}
