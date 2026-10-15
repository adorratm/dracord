import type { DracordClient } from '@dracord/sdk';

type VoiceLike = {
  voiceChannelId: string | null;
  leave: () => void | Promise<void>;
} | null | undefined;

/**
 * Aktivite + oyun/watch kanalı sesini birlikte temizler.
 * Watch party native voice’a bağlıdır — ayrılınca voice.leave şart.
 */
export async function leaveActivityFully(opts: {
  client: DracordClient;
  sessionId: string | null | undefined;
  channelId: string | null | undefined;
  clearActiveActivity: () => void;
  voice?: VoiceLike;
}): Promise<void> {
  const { client, sessionId, channelId, clearActiveActivity, voice } = opts;
  const voiceCh = voice?.voiceChannelId ?? null;

  if (voice && channelId && voiceCh === channelId) {
    await Promise.resolve(voice.leave()).catch(() => undefined);
  }

  clearActiveActivity();
  if (sessionId) {
    await client.leaveActivity(sessionId).catch(() => undefined);
  }
  if (!channelId) return;

  await client.leaveVoiceState(channelId).catch(() => undefined);

  if (voice?.voiceChannelId === channelId) {
    await Promise.resolve(voice.leave()).catch(() => undefined);
  }
}
