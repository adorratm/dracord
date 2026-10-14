import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '../web');
const srcRoot = path.resolve(__dirname, 'src');

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      // Web aktivite / oyun bağımlılıkları (Three.js stack)
      { find: '@/lib/game-audio', replacement: path.join(webRoot, 'lib/game-audio.ts') },
      { find: '@/lib/game-fullscreen', replacement: path.join(webRoot, 'lib/game-fullscreen.ts') },
      { find: '@/lib/dealer-voice', replacement: path.join(webRoot, 'lib/dealer-voice.ts') },
      { find: '@/lib/dealer-lines', replacement: path.join(webRoot, 'lib/dealer-lines.ts') },
      { find: '@/lib/sounds', replacement: path.join(webRoot, 'lib/sounds.ts') },
      { find: '@/lib/watch-party-media', replacement: path.join(webRoot, 'lib/watch-party-media.ts') },
      { find: '@/lib/analytics', replacement: path.join(srcRoot, 'lib/analytics-stub.ts') },
      { find: '@/lib/voice-settings', replacement: path.join(webRoot, 'lib/voice-settings.ts') },
      {
        find: '@/lib/participant-volumes',
        replacement: path.join(webRoot, 'lib/participant-volumes.ts'),
      },
      {
        find: '@/lib/nsfw-screen-guard',
        replacement: path.join(webRoot, 'lib/nsfw-screen-guard.ts'),
      },
      {
        find: '@/components/activities/games/WatchEmbedPlayer',
        replacement: path.join(webRoot, 'components/activities/games/WatchEmbedPlayer.tsx'),
      },
      {
        find: '@/components/MusicPlayerBar',
        replacement: path.join(webRoot, 'components/MusicPlayerBar.tsx'),
      },
      {
        find: '@/components/AuthProvider',
        replacement: path.join(srcRoot, 'shims/AuthProvider.ts'),
      },
      {
        find: '@/components/VoiceSessionProvider',
        replacement: path.join(srcRoot, 'shims/VoiceSessionProvider.ts'),
      },
      { find: '@', replacement: srcRoot },
    ],
    dedupe: ['react', 'react-dom', 'three'],
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
  optimizeDeps: {
    include: [
      '@dracord/sdk',
      '@dracord/types',
      '@dracord/game-core',
      '@dracord/app-theme',
      '@dracord/ui',
      '@tanstack/react-virtual',
      'three',
      'livekit-client',
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    commonjsOptions: { include: [/node_modules/, /packages/] },
  },
});
