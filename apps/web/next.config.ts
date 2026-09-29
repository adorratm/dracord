import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@dracord/ui',
    '@dracord/sdk',
    '@dracord/types',
    'denoise-voice-clarity',
  ],
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
