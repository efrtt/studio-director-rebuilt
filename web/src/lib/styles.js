// All styling lives in `styles.css`, imported as text so Vite can minify it.
//
// It used to be a template literal here, which meant the bundler treated 27 KB of
// CSS as a string: comments, indentation and all of it shipped verbatim. A real
// `.css` file goes through Vite's CSS pipeline instead, and `?inline` keeps the
// single-artifact promise (no CSS sidecar to fetch, so it still inlines into the
// userscript).
// Open Sans, inlined as data: URIs with its OFL notice (see fonts.css). It is
// first in the cascade so the face is registered before any rule asks for it.
import FONTS from '../fonts.css?inline';
import CSS from '../styles.css?inline';
// The Wii skin lives only on `wii-skin`: it is a theme of its own, carried there by
// its own stylesheet. A build of `main` never offers it, so there is nothing on this
// line for a second sheet to do.


export function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sd-styles')) return;
  const el = document.createElement('style');
  el.id = 'sd-styles';
  el.textContent = `${FONTS}\n${CSS}`;
  (document.head || document.documentElement).appendChild(el);
}

export function removeStyles() {
  const el = document.getElementById('sd-styles');
  if (el) el.remove();
}
