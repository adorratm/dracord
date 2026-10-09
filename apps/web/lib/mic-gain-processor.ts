import type { TrackProcessor, ProcessorOptions } from 'livekit-client';
import { Track } from 'livekit-client';
import { softVolumeCurve } from '@/lib/voice-settings';

/**
 * Mikrofon: headroom’lu gain → yumuşak compressor → hafif makeup.
 * AudioContext örnekleme hızı track ile hizalanır — uyumsuzluk robotik sese yol açar.
 */
export class MicGainProcessor implements TrackProcessor<Track.Kind.Audio> {
  readonly name = 'dracord-mic-gain';
  processedTrack?: MediaStreamTrack;

  private source?: MediaStreamAudioSourceNode;
  private gainNode?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private makeup?: GainNode;
  private destination?: MediaStreamAudioDestinationNode;
  private audioContext?: AudioContext;
  private ownsContext = false;
  private gain: number;

  constructor(gain = 1) {
    this.gain = softVolumeCurve(gain);
  }

  setGain(gain: number) {
    this.gain = softVolumeCurve(gain);
    if (this.gainNode) {
      this.gainNode.gain.setTargetAtTime(this.gain, this.audioContext?.currentTime ?? 0, 0.02);
    }
  }

  /** Context askıdaysa veya kapalıysa true — yeniden kurulum gerekir */
  needsRecovery(): boolean {
    const ctx = this.audioContext;
    if (!ctx) return true;
    if (ctx.state === 'closed') return true;
    if (ctx.state === 'suspended') return true;
    const out = this.processedTrack;
    if (!out || out.readyState !== 'live') return true;
    return false;
  }

  async resumeContext(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume().catch(() => undefined);
    }
  }

  async init(opts: ProcessorOptions<Track.Kind.Audio>): Promise<void> {
    await this.setup(opts);
  }

  async restart(opts: ProcessorOptions<Track.Kind.Audio>): Promise<void> {
    await this.destroy();
    await this.setup(opts);
  }

  async destroy(): Promise<void> {
    try {
      this.source?.disconnect();
      this.gainNode?.disconnect();
      this.compressor?.disconnect();
      this.makeup?.disconnect();
    } catch {
      // ignore
    }
    this.source = undefined;
    this.gainNode = undefined;
    this.compressor = undefined;
    this.makeup = undefined;
    this.destination = undefined;
    this.processedTrack = undefined;
    if (this.ownsContext) {
      void this.audioContext?.close().catch(() => undefined);
    }
    this.audioContext = undefined;
    this.ownsContext = false;
  }

  private async setup(opts: ProcessorOptions<Track.Kind.Audio>) {
    if (opts.audioContext) {
      this.audioContext = opts.audioContext;
      this.ownsContext = false;
    } else {
      const trackRate = opts.track.getSettings?.().sampleRate;
      const sampleRate =
        typeof trackRate === 'number' && trackRate >= 16000 && trackRate <= 96000
          ? trackRate
          : 48000;
      try {
        this.audioContext = new AudioContext({ sampleRate });
      } catch {
        this.audioContext = new AudioContext();
      }
      this.ownsContext = true;
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => undefined);
    }
    const t = this.audioContext.currentTime;
    this.source = this.audioContext.createMediaStreamSource(new MediaStream([opts.track]));
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.gain;

    // Yumuşak limiter — aşırı ratio robotik / “su altında” bozulmaya yol açıyordu
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, t);
    this.compressor.knee.setValueAtTime(18, t);
    this.compressor.ratio.setValueAtTime(6, t);
    this.compressor.attack.setValueAtTime(0.003, t);
    this.compressor.release.setValueAtTime(0.22, t);

    this.makeup = this.audioContext.createGain();
    this.makeup.gain.value = 0.9;

    this.destination = this.audioContext.createMediaStreamDestination();
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.compressor);
    this.compressor.connect(this.makeup);
    this.makeup.connect(this.destination);
    const out = this.destination.stream.getAudioTracks()[0];
    if (!out) throw new Error('Mic gain çıkış track oluşturulamadı');
    // İşlenmiş track’i mümkün olduğunca kaynak ile aynı kısıtlarda tut
    try {
      const settings = opts.track.getSettings();
      if (settings.sampleRate || settings.channelCount) {
        void out.applyConstraints({
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount ?? 1,
        }).catch(() => undefined);
      }
    } catch {
      // ignore
    }
    this.processedTrack = out;
  }
}
