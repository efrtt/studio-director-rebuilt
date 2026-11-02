// The accent colour, and where the choice is kept.
//
// The palette lives in CSS, so this is deliberately tiny: a list of names, the
// label a picker shows, and the attribute the stylesheet keyed its rules on.
// Each preset sets a single hex per theme (`--accent`) and everything else —
// the soft fills, the focus ring, the selected row — is derived from it with
// color-mix() in the stylesheet. That is what makes a new colour two lines
// instead of a rule for every state.
//
// Kept out of `theme.js` on purpose: light/dark is resolved from the OS and
// decides which stylesheet rules apply; an accent is just a value plugged into
// them, and the two should be readable and testable apart.

const KEY = 'sd.accent';

export const ACCENTS = ['blue', 'violet', 'teal', 'green', 'amber', 'rose'];

export const ACCENT_LABEL = {
  blue: 'Blue',
  violet: 'Violet',
  teal: 'Teal',
  green: 'Green',
  amber: 'Amber',
  rose: 'Rose'
};

// The dot in the picker needs one concrete colour, and it should be the colour
// the light theme will actually show: on paper the accent is the deeper step.
export const ACCENT_SWATCH = {
  blue: '#34599f',
  violet: '#6a45c0',
  teal: '#0f6f68',
  green: '#1f7a4c',
  amber: '#8a5a12',
  rose: '#a3305a'
};

export const DEFAULT_ACCENT = 'blue';

function store() {
  try {
    return globalThis.localStorage || null;
  } catch (e) {
    // Private mode, or a context without storage: not remembered, still usable.
    return null;
  }
}

export function readAccent(s = store()) {
  try {
    const value = s && s.getItem(KEY);
    return ACCENTS.includes(value) ? value : DEFAULT_ACCENT;
  } catch (e) {
    return DEFAULT_ACCENT;
  }
}

export function writeAccent(accent, s = store()) {
  if (!ACCENTS.includes(accent)) return false;
  try {
    if (s) s.setItem(KEY, accent);
    return true;
  } catch (e) {
    return false;
  }
}

// Writes the attribute the stylesheet reads, on the same element the theme is
// written to. Returns the value it wrote, or null when there is nothing to write
// to (a non-DOM context, or a test's bare object).
export function applyAccent(accent, root = globalThis.document && globalThis.document.documentElement) {
  if (!root || !root.setAttribute) return null;
  const name = ACCENTS.includes(accent) ? accent : DEFAULT_ACCENT;
  root.setAttribute('data-sd-accent', name);
  return name;
}
