import {
  Track,
  VideoPresets,
  VideoQuality,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type Track as LkTrack,
  type VideoPreset,
} from 'livekit-client';
import {
  SCREEN_SHARE_VIEW_QUALITY_SPECS,
  softVolumeCurve,
  type ScreenShareViewQualityId,
} from '@/lib/voice-settings';

export type ActiveScreenShare = {
  identity: string;
  displayName: string;
  isLocal: boolean;
};

export function screenShareSimulcastLayersForHeight(height: number): VideoPreset[] {
  // Daha az katman = daha az encode CPU (desktop takılma)
  if (height >= 2160) return [VideoPresets.h1080];
  if (height >= 1440) return [VideoPresets.h720];
  if (height >= 1080) return [VideoPresets.h720];
  if (height >= 720) return [VideoPresets.h360];
  return [VideoPresets.h180];
}

export function screenShareErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err);
  if (
    name === 'NotAllowedError' ||
    /permission denied|notallowed|denied by user/i.test(msg)
  ) {
    return 'Ekran paylaşımı iptal edildi veya izin verilmedi. Tekrar dene; açılan pencerede sekme/pencere seçip Paylaş’a bas.';
  }
  if (name === 'NotFoundError' || /not found/i.test(msg)) {
    return 'Paylaşılacak ekran veya pencere bulunamadı.';
  }
  if (/could not start audio source|audio source|getDisplayMedia.*audio/i.test(msg)) {
    return 'Sistem sesi alınamadı; paylaşım sessiz video ile devam edebilir.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Ekran paylaşımı yalnızca güvenli bağlamda çalışır.';
  }
  return msg || 'Ekran paylaşımı başarısız';
}

export function isScreenShareAudioFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /could not start audio source|audio source|NotReadableError|AbortError/i.test(msg);
}

export function setRemoteSourceVolume(
  participant: RemoteParticipant,
  source: Track.Source,
  level: number,
) {
  const pub = participant.getTrackPublication(source);
  const track = pub?.track as unknown as { setVolume?: (v: number) => void } | undefined;
  if (track && typeof track.setVolume === 'function') {
    track.setVolume(level);
  }
}

export function listenLevel(outputVolume: number, personalPct: number): number {
  return softVolumeCurve(outputVolume) * softVolumeCurve(personalPct / 100);
}

let screenShareQualityFloorEl: HTMLVideoElement | null = null;
let screenShareQualityFloorTrack: LkTrack | null = null;

function ensureScreenShareQualityFloor(): HTMLVideoElement {
  if (screenShareQualityFloorEl && screenShareQualityFloorEl.isConnected) {
    return screenShareQualityFloorEl;
  }
  const el = document.createElement('video');
  el.setAttribute('aria-hidden', 'true');
  el.muted = true;
  el.playsInline = true;
  el.style.cssText =
    'position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(el);
  screenShareQualityFloorEl = el;
  return el;
}

export function clearScreenShareQualityFloor() {
  const el = screenShareQualityFloorEl;
  const prev = screenShareQualityFloorTrack;
  if (el && prev) {
    try {
      prev.detach(el);
    } catch {
      /* ignore */
    }
  }
  screenShareQualityFloorTrack = null;
  if (el) {
    el.style.width = '0px';
    el.style.height = '0px';
  }
}

function bindScreenShareQualityFloor(track: LkTrack, width: number, height: number) {
  try {
    const floor = ensureScreenShareQualityFloor();
    if (screenShareQualityFloorTrack && screenShareQualityFloorTrack !== track) {
      try {
        screenShareQualityFloorTrack.detach(floor);
      } catch {
        /* ignore */
      }
    }
    floor.style.width = `${width}px`;
    floor.style.height = `${height}px`;
    track.attach(floor);
    screenShareQualityFloorTrack = track;
    void floor.play().catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export function applyRemoteScreenShareViewQuality(
  pub: RemoteTrackPublication,
  qualityId: ScreenShareViewQualityId,
  opts?: { focused?: boolean },
) {
  const spec = SCREEN_SHARE_VIEW_QUALITY_SPECS[qualityId];
  const track = pub.track ?? null;
  const focused = opts?.focused !== false;

  if (qualityId === 'auto') {
    if (focused) clearScreenShareQualityFloor();
    // HIGH zorlamayı kaldır — adaptiveStream katman seçsin (CPU/bant)
    try {
      pub.setVideoQuality(VideoQuality.MEDIUM);
    } catch {
      /* ignore */
    }
    return;
  }

  const width = spec.width ?? 7680;
  const height = spec.height ?? 4320;
  if (focused && track) bindScreenShareQualityFloor(track, width, height);
  try {
    pub.setVideoDimensions({ width, height });
  } catch {
    /* ignore */
  }
}
