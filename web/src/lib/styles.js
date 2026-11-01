// All styling lives in `styles.css`, imported as text so Vite can minify it.
//
// It used to be a template literal here, which meant the bundler treated 27 KB of
// CSS as a string: comments, indentation and all of it shipped verbatim. A real
// `.css` file goes through Vite's CSS pipeline instead, and `?inline` keeps the
// single-artifact promise (no CSS sidecar to fetch, so it still inlines into the
// userscript).
import CSS from '../styles.css?inline';
// The Wii skin is a theme, not a second stylesheet: it is appended so a mount
// injects one <style> and the userscript stays one file with nothing to fetch.
import WII from '../wii.css?inline';


export function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sd-styles')) return;
  const el = document.createElement('style');
  el.id = 'sd-styles';
  el.textContent = `${CSS}\n${WII}`;
  (document.head || document.documentElement).appendChild(el);
}

export function removeStyles() {
  const el = document.getElementById('sd-styles');
  if (el) el.remove();
}
