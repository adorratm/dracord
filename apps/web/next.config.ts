import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@dracord/ui',
    '@dracord/sdk',
    '@dracord/types',
    'denoise-voice-clarity',
  ],
  // NSFW modeli yalnızca istemci dinamik import; RSC bundle’ına sokma
  serverExternalPackages: ['@tensorflow/tfjs', 'nsfwjs', 'edge-tts-universal'],
  experimental: {
    // Barrel (index.ts) içe aktarımlarını doğrudan modüle çevir — kullanılmayan UI bileşenleri paketlenmesin
    optimizePackageImports: ['@dracord/ui'],
  },
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  async rewrites() {
    return [
      { source: '/channels/@me', destination: '/channels/me' },
      { source: '/channels/@me/:channelId', destination: '/channels/me/:channelId' },
    ];
  },
};

export default nextConfig;
