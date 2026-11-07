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
// The Wii skin is a theme, not a second stylesheet: it is appended so a mount
// injects one <style> and the userscript stays one file with nothing to fetch.
import WII from '../wii.css?inline';
// The Island theme does the same, and brings its own type: `acnh-fonts.css` holds
// the Nunito faces as data: URIs, so only a build that offers the theme carries
// them - `main` has neither the theme nor the 52 KiB of font.
import ACNH_FONTS from '../acnh-fonts.css?inline';
import ACNH from '../acnh.css?inline';


export function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sd-styles')) return;
  const el = document.createElement('style');
  el.id = 'sd-styles';
  el.textContent = `${FONTS}\n${CSS}\n${WII}\n${ACNH_FONTS}\n${ACNH}`;
  (document.head || document.documentElement).appendChild(el);
}

export function removeStyles() {
  const el = document.getElementById('sd-styles');
  if (el) el.remove();
}
