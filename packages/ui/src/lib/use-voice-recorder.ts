import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VOICE_MESSAGE_MAX_SEC,
  VOICE_WAVEFORM_POINTS,
  type MessageAttachment,
  type MessageDto,
} from '@dracord/types';

export type VoiceRecording = {
  blob: Blob;
  mime: string;
  durationSec: number;
  waveform: number[];
};

export type VoiceRecorderState = 'idle' | 'requesting' | 'recording' | 'error';

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const cands = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  return cands.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '';
}

export function voiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/** Ham genlik örneklerini N kovaya indir (0–255) */
function downsample(samples: number[], n = VOICE_WAVEFORM_POINTS): number[] {
  if (!samples.length) return new Array(n).fill(0);
  const out: number[] = [];
  const step = samples.length / n;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * step);
    const b = Math.max(a + 1, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = a; j < b && j < samples.length; j++) peak = Math.max(peak, samples[j]!);
    out.push(peak);
  }
  const max = Math.max(1, ...out);
  return out.map((v) => Math.round((v / max) * 255));
}

/**
 * Tarayıcı / Electron sesli mesaj kaydedici (MediaRecorder + AnalyserNode dalga formu).
 * En fazla VOICE_MESSAGE_MAX_SEC; süre dolunca otomatik durur.
 */
export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const chunks = useRef<Blob[]>([]);
  const samples = useRef<number[]>([]);
  const startedAt = useRef(0);
  const raf = useRef<number | null>(null);
  const resolveStop = useRef<((r: VoiceRecording | null) => void) | null>(null);
  const cancelled = useRef(false);

  const cleanup = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    rec.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => {
    cancelled.current = true;
    try {
      rec.current?.stop();
    } catch {
      /* ignore */
    }
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (!voiceRecordingSupported()) {
      setError('Bu cihazda ses kaydı desteklenmiyor');
      setState('error');
      return;
    }
    setError(null);
    setState('requesting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.current = s;
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined);
      rec.current = r;
      chunks.current = [];
      samples.current = [];
      cancelled.current = false;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.onstop = () => {
        const durationSec = Math.min(VOICE_MESSAGE_MAX_SEC, (performance.now() - startedAt.current) / 1000);
        const type = r.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunks.current, { type });
        const result: VoiceRecording | null =
          cancelled.current || durationSec < 0.7 || !blob.size
            ? null
            : { blob, mime: type.split(';')[0]!, durationSec, waveform: downsample(samples.current) };
        cleanup();
        setState('idle');
        setElapsed(0);
        resolveStop.current?.(result);
        resolveStop.current = null;
      };
      // Dalga formu
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      ctx.current = ac;
      const src = ac.createMediaStreamSource(s);
      const an = ac.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      let lastSample = 0;
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]! - 128));
        const now = performance.now();
        setLevel(peak / 128);
        if (now - lastSample > 50) {
          samples.current.push(peak);
          lastSample = now;
        }
        const el = (now - startedAt.current) / 1000;
        setElapsed(el);
        if (el >= VOICE_MESSAGE_MAX_SEC) {
          try {
            r.stop();
          } catch {
            /* ignore */
          }
          return;
        }
        raf.current = requestAnimationFrame(tick);
      };
      startedAt.current = performance.now();
      r.start(250);
      setState('recording');
      raf.current = requestAnimationFrame(tick);
    } catch (e) {
      cleanup();
      const name = e instanceof DOMException ? e.name : '';
      setError(name === 'NotAllowedError' ? 'Mikrofon izni verilmedi' : 'Mikrofon açılamadı');
      setState('error');
    }
  }, [cleanup]);

  /** Kaydı bitir → kayıt (çok kısaysa null) */
  const stop = useCallback((): Promise<VoiceRecording | null> => {
    const r = rec.current;
    if (!r || r.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      resolveStop.current = resolve;
      try {
        r.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    const r = rec.current;
    if (r && r.state !== 'inactive') {
      try {
        r.stop();
      } catch {
        cleanup();
        setState('idle');
      }
    } else {
      cleanup();
      setState('idle');
    }
    setElapsed(0);
  }, [cleanup]);

  return { state, elapsed, level, error, start, stop, cancel, clearError: () => setError(null) };
}

export type VoiceMessageClient = {
  uploadFile(file: File, folder?: string): Promise<MessageAttachment>;
  sendMessage(
    channelId: string,
    content: string,
    attachments?: MessageAttachment[],
    poll?: undefined,
    opts?: { replyToId?: string },
  ): Promise<MessageDto>;
};

/** Kaydı yükle + mesaj olarak gönder */
export async function sendVoiceMessage(
  client: VoiceMessageClient,
  channelId: string,
  recording: VoiceRecording,
  opts?: { replyToId?: string },
): Promise<MessageDto> {
  const ext = recording.mime.includes('mp4') ? 'm4a' : recording.mime.includes('ogg') ? 'ogg' : 'webm';
  const file = new File([recording.blob], `sesli-mesaj-${Date.now()}.${ext}`, { type: recording.mime });
  const att = await client.uploadFile(file);
  return client.sendMessage(
    channelId,
    '',
    [{ ...att, voice: true, durationSec: Math.round(recording.durationSec * 10) / 10, waveform: recording.waveform }],
    undefined,
    opts,
  );
}

export function formatVoiceDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
