import type { TrackProcessor, ProcessorOptions } from 'livekit-client';
import { Track } from 'livekit-client';
import { softVolumeCurve } from '@/lib/voice-settings';

/**
 * Mikrofon kazancı + soft limiter.
 * Gain tek başına clipping/patlama yapıyordu; compressor tepe seviyesini tutar.
 */
export class MicGainProcessor implements TrackProcessor<Track.Kind.Audio> {
  readonly name = 'dracord-mic-gain';
  processedTrack?: MediaStreamTrack;

  private source?: MediaStreamAudioSourceNode;
  private gainNode?: GainNode;
  private compressor?: DynamicsCompressorNode;
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
    } catch {
      // ignore
    }
    this.source = undefined;
    this.gainNode = undefined;
    this.compressor = undefined;
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
      this.audioContext = new AudioContext();
      this.ownsContext = true;
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => undefined);
    }
    this.source = this.audioContext.createMediaStreamSource(new MediaStream([opts.track]));
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.gain;

    // Soft knee limiter — ani tepeleri kırp, “patlamayı” azalt
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-18, this.audioContext.currentTime);
    this.compressor.knee.setValueAtTime(12, this.audioContext.currentTime);
    this.compressor.ratio.setValueAtTime(8, this.audioContext.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
    this.compressor.release.setValueAtTime(0.18, this.audioContext.currentTime);

    this.destination = this.audioContext.createMediaStreamDestination();
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.compressor);
    this.compressor.connect(this.destination);
    const out = this.destination.stream.getAudioTracks()[0];
    if (!out) throw new Error('Mic gain çıkış track oluşturulamadı');
    this.processedTrack = out;
  }
}
