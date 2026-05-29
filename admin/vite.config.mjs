import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built admin SPA can be hosted from any static subpath
// (GitHub Pages project sites, etc.), consistent with the SDK's static-first posture.
export default defineConfig({
  plugins: [react()],
  base: './',
});
