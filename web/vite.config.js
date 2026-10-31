import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// One IIFE artifact with no CSS sidecar, so the whole UI can be inlined into a
// single userscript. All styling lives in src/lib/styles.js and is injected.
export default defineConfig({
  plugins: [svelte()],
  build: {
    lib: {
      entry: 'src/main.js',
      name: 'SD',
      formats: ['iife'],
      fileName: () => 'sd.js'
    },
    cssCodeSplit: false,
    emptyOutDir: true,
    target: 'es2020'
  }
});
