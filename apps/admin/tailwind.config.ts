import type { Config } from 'tailwindcss';
import dracordPreset from '@dracord/config/tailwind';

const config: Config = {
  presets: [dracordPreset as Config],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
};

export default config;
