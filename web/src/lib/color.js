// Ink for a fill the app chose.
//
// The calendar's blocks carry the class colour as an inline background, and some
// of them also carry a text colour. The ones that do not inherited `--text`,
// which is white in the dark theme — so a cyan block got white text and became
// unreadable the moment the theme changed.
//
// The app's palette is not ours to change, so the ink is derived from the fill:
// luminance decides between near-black and white, which is correct for both
// themes because it depends only on what is underneath.

const LIGHT_INK = '#0b1220';
const DARK_INK = '#ffffff';

function channels(fill) {
  const value = String(fill || '').trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const d = hex[1];
    const full = d.length === 3 ? d.split('').map((c) => c + c).join('') : d;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map(Number);
  return null;
}

// Relative luminance, sRGB (WCAG 2.1). Anything at or above the midpoint takes
// dark ink; below it takes white.
export function luminanceOf(fill) {
  const rgb = channels(fill);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = Math.max(0, Math.min(255, v)) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// A fill we cannot parse returns null, and the caller keeps `inherit`.
export function inkFor(fill) {
  const l = luminanceOf(fill);
  if (l === null) return null;
  return l >= 0.179 ? LIGHT_INK : DARK_INK;
}
