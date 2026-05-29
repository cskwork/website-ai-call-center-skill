import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built admin SPA can be hosted from any static subpath
// (GitHub Pages project sites, etc.), consistent with the SDK's static-first posture.
export default defineConfig({
  plugins: [react()],
  base: './',
  // Starter templates import the prebuilt bundles from the repo's ../bundles dir.
  // The production build resolves these fine; allow the dev server to read the
  // parent so `npm run dev --prefix admin` can serve them too.
  server: { fs: { allow: ['..'] } },
});
