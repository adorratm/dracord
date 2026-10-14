import type { Config } from 'tailwindcss';
import dracordPreset from '@dracord/config/tailwind';

const config: Config = {
  presets: [dracordPreset as Config],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    '../web/components/activities/**/*.{js,ts,jsx,tsx}',
  ],
};

export default config;
