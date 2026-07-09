import { defineConfig } from 'astro/config';
import tailwindcss from './tailwind-plugin.mjs';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});