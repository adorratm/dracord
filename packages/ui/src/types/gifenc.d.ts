declare module 'gifenc' {
  export type Palette = number[][];

  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' },
  ): Palette;

  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: Palette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;

  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: Palette;
        delay?: number;
        first?: boolean;
        transparent?: boolean;
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  }

  export function GIFEncoder(opts?: { auto?: boolean }): GIFEncoderInstance;
}
