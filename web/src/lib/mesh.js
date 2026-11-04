// A drifting mesh field.
//
// CSS cannot move a gradient's own colour around: one property drives every
// background layer, so a field of several spots would travel as one block. The
// motion is sampled here instead and handed to the Web Animations API.
//
// Each spot is one vector turning at a steady rate plus a smaller one turning
// three times as fast. Keeping 3 * WOBBLE under RADIUS means the combined
// velocity never reaches zero, so the tangent keeps turning and the path has no
// cusp - a curve whose speed drops to nothing is exactly what reads as a sudden
// change of direction. The loop closes on itself with matching tangents.

const RADIUS = 20;
const WOBBLE = 4;
const SAMPLES = 36;

// One lap per spot, in ms. Four different lengths, so the spots cross each other
// instead of travelling together.
export const MESH_LAPS = [4200, 5100, 3400, 6000];

/** The keyframes for one spot of a field: a closed, smooth loop that never cusps. */
export function meshFrames(seed, spot) {
  const phase = (n) => seed * 1.7 + spot * 2.1 + n;
  const frames = [];
  for (let s = 0; s <= SAMPLES; s++) {
    const t = s / SAMPLES;
    const a = 2 * Math.PI * t;
    const x = RADIUS * Math.cos(a + phase(0)) + WOBBLE * Math.cos(3 * a + phase(1));
    const y = (RADIUS * Math.sin(a + phase(0)) + WOBBLE * Math.sin(3 * a + phase(1))) * 0.82;
    frames.push({ offset: t, transform: `translate3d(${x.toFixed(2)}%, ${y.toFixed(2)}%, 0)` });
  }
  return frames;
}

/**
 * Start the field inside one host - an element holding the `<i>` spots.
 * Returns the running animations so a caller can pause or cancel them.
 */
export function runMesh(host, seed = 0) {
  if (!host || typeof host.querySelectorAll !== 'function') return [];
  const spots = [...host.querySelectorAll('i')].filter((spot) => typeof spot.animate === 'function');
  return spots.map((spot, k) =>
    spot.animate(meshFrames(seed, k), {
      duration: MESH_LAPS[k % MESH_LAPS.length],
      delay: -(seed * 1900 + k * 3700),
      iterations: Infinity,
      easing: 'linear',
    })
  );
}

// ---- legibility -------------------------------------------------------------
//
// The label is one dark ink on white and on colour alike, so a saturated tint has
// to stay light enough for it. Blue and violet at the same lightness as yellow
// would fail that, so each hue asks for the lightness it needs to clear 4.6:1
// (WCAG AA for body text, with a little room).

const INK = [4, 26, 41];

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function hslToRgb(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** The lightness a hue's tint needs to stay legible under the channel label. */
export function tintLightness(hue, saturation = 92) {
  for (let l = 58; l <= 78; l += 0.5) {
    if (contrast(hslToRgb(hue, saturation, l), INK) >= 4.6) return l;
  }
  return 78;
}
