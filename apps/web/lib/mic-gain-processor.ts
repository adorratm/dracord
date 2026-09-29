import type { TrackProcessor, ProcessorOptions } from 'livekit-client';
import { Track } from 'livekit-client';

/** LiveKit mikrofon track'ine yazılım kazancı uygular (gönderilen ses seviyesi). */
export class MicGainProcessor implements TrackProcessor<Track.Kind.Audio> {
  readonly name = 'dracord-mic-gain';
  processedTrack?: MediaStreamTrack;

  private source?: MediaStreamAudioSourceNode;
  private gainNode?: GainNode;
  private destination?: MediaStreamAudioDestinationNode;
  private audioContext?: AudioContext;
  private ownsContext = false;
  private gain: number;

  constructor(gain = 1) {
    this.gain = gain;
  }

  setGain(gain: number) {
    this.gain = Math.min(2, Math.max(0, gain));
    if (this.gainNode) {
      this.gainNode.gain.setTargetAtTime(this.gain, this.audioContext?.currentTime ?? 0, 0.015);
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
    } catch {
      // ignore
    }
    this.source = undefined;
    this.gainNode = undefined;
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
    this.destination = this.audioContext.createMediaStreamDestination();
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.destination);
    const out = this.destination.stream.getAudioTracks()[0];
    if (!out) throw new Error('Mic gain çıkış track oluşturulamadı');
    this.processedTrack = out;
  }
}
