'use client';

/**
 * Ses oturumu kabuğu — LiveKit içeren VoiceSessionProvider ile gelen arama dinleyicisi.
 * Yalnız `VoiceGate` üzerinden tembel yüklenir: herkese açık sayfalar (tanıtım, giriş, indirme…)
 * ~600 KB'lık LiveKit paketini indirmez.
 */
import type { ReactNode } from 'react';
import { VoiceSessionProvider } from '@/components/VoiceSessionProvider';
import { DmIncomingCallListener } from '@/components/DmCallControls';
import { VoiceSummonListener } from '@/components/VoiceSummonListener';

export default function VoiceShell({ children }: { children: ReactNode }) {
  return (
    <VoiceSessionProvider>
      <DmIncomingCallListener />
      <VoiceSummonListener />
      {children}
    </VoiceSessionProvider>
  );
}
