import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// One IIFE artifact with no CSS sidecar, so the whole UI can be inlined into a
// single userscript. All styling lives in src/lib/styles.js and is injected.
// One place the version is read: package.json, at build time, so the running
// skin can say which build it is. "Which version are you on?" then has an answer
// on the page instead of in a conversation.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __SD_VERSION__: JSON.stringify(pkg.version) },
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
