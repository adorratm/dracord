/**
 * A9 — RNNoise (xiph, ~150 KB WebAssembly) as a LiveKit audio track processor.
 * Light enough for any PC; used on the desktop app and as the light / fallback
 * mode on the web (DeepFilterNet is the strong mode there).
 *
 * Self-contained: the worklet code and the wasm are inlined and loaded from Blobs,
 * so nothing has to be served as a static file.
 */

const PROCESSOR_ID = '@sapphi-red/web-noise-suppressor/rnnoise';
const SAMPLE_RATE = 48_000;

/** the subset of LiveKit's TrackProcessor contract we implement */
export interface AudioTrackProcessorLike {
  name: string;
  processedTrack?: MediaStreamTrack;
  init(opts: { track: MediaStreamTrack }): Promise<void>;
  restart(opts: { track: MediaStreamTrack }): Promise<void>;
  destroy(): Promise<void>;
}

const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

export function isRnnoiseSupported(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof AudioContext !== 'undefined' &&
      typeof AudioWorkletNode !== 'undefined' &&
      typeof WebAssembly !== 'undefined'
    );
  } catch {
    return false;
  }
}

let wasmPromise: Promise<ArrayBuffer> | null = null;
function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function loadWasm(): Promise<ArrayBuffer> {
  wasmPromise ??= (async () => {
    const simd = WebAssembly.validate(SIMD_PROBE);
    const mod = simd ? await import('./rnnoise/wasm-simd') : await import('./rnnoise/wasm-plain');
    return b64ToBuffer(mod.RNNOISE_WASM_BASE64);
  })();
  return wasmPromise;
}

let workletUrl: string | null = null;
async function workletModuleUrl(): Promise<string> {
  if (workletUrl) return workletUrl;
  const { RNNOISE_WORKLET_SOURCE } = await import('./rnnoise/worklet-source');
  workletUrl = URL.createObjectURL(new Blob([RNNOISE_WORKLET_SOURCE], { type: 'text/javascript' }));
  return workletUrl;
}

/** mic → RNNoise (48 kHz, its native rate) → a new MediaStreamTrack for LiveKit to send */
export class RnnoiseTrackProcessor implements AudioTrackProcessorLike {
  name = 'dracord-rnnoise';
  processedTrack?: MediaStreamTrack;
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  async init({ track }: { track: MediaStreamTrack }): Promise<void> {
    const wasmBinary = await loadWasm();
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule(await workletModuleUrl());
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    const node = new AudioWorkletNode(ctx, PROCESSOR_ID, { processorOptions: { maxChannels: 1, wasmBinary } });
    const dest = ctx.createMediaStreamDestination();
    source.connect(node).connect(dest);
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    this.ctx = ctx;
    this.node = node;
    this.source = source;
    this.processedTrack = dest.stream.getAudioTracks()[0];
  }

  async restart(opts: { track: MediaStreamTrack }): Promise<void> {
    await this.destroy();
    await this.init(opts);
  }

  async destroy(): Promise<void> {
    try {
      this.node?.port.postMessage('destroy');
      this.source?.disconnect();
      this.node?.disconnect();
    } catch {
      /* already torn down */
    }
    const ctx = this.ctx;
    this.ctx = null;
    this.node = null;
    this.source = null;
    this.processedTrack = undefined;
    if (ctx && ctx.state !== 'closed') await ctx.close().catch(() => undefined);
  }
}

/** which engine the web uses when noise suppression is on */
export type NoiseEngine = 'deepfilter' | 'rnnoise';
export const NOISE_ENGINE_KEY = 'dracord.noise-engine';

export function loadNoiseEngine(): NoiseEngine {
  try {
    return localStorage.getItem(NOISE_ENGINE_KEY) === 'rnnoise' ? 'rnnoise' : 'deepfilter';
  } catch {
    return 'deepfilter';
  }
}

export function saveNoiseEngine(e: NoiseEngine): void {
  try {
    localStorage.setItem(NOISE_ENGINE_KEY, e);
  } catch {
    /* private mode */
  }
}
