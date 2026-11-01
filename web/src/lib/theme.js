// The colour scheme, and where the choice is kept.
//
// The palette is CSS variables on `#sd-root` (see `lib/styles.js`), so a theme is
// a set of values, not a second stylesheet. `auto` exists because a machine's own
// light/dark setting is usually the right answer; it is resolved to an explicit
// `light` or `dark` before it reaches the DOM, so the CSS never has to query the
// OS and a test can decide the answer.
//
// Deliberately small and side-effect free: reading and writing a preference, and
// turning one of the three choices into the value the attribute carries.

const KEY = 'sd.theme';

// Dark first: it is the look the build has always had, so a fresh install is
// unchanged until somebody cycles the button.
export const THEMES = ['dark', 'light', 'auto'];

export const THEME_LABEL = { dark: 'Dark', light: 'Light', auto: 'Auto' };

function store() {
  try {
    return globalThis.localStorage || null;
  } catch (e) {
    // Private mode, or a context without storage: the preference is just not
    // remembered, which is not a reason to break the mount.
    return null;
  }
}

function prefersDark() {
  try {
    return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (e) {
    return true;
  }
}

export function readTheme(s = store()) {
  try {
    const value = s && s.getItem(KEY);
    return THEMES.includes(value) ? value : 'dark';
  } catch (e) {
    return 'dark';
  }
}

export function writeTheme(theme, s = store()) {
  if (!THEMES.includes(theme)) return false;
  try {
    if (s) s.setItem(KEY, theme);
    return true;
  } catch (e) {
    return false;
  }
}

// The three choices in order, so one button can cycle them.
export function nextTheme(theme) {
  const at = THEMES.indexOf(theme);
  return THEMES[(at + 1) % THEMES.length];
}

// `auto` is resolved here rather than in CSS, so there is one place that decides
// what it means and a test can pin it.
export function themeName(theme, osPrefersDark = prefersDark()) {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return osPrefersDark ? 'dark' : 'light';
}

// Writes the attribute the stylesheet reads. Returns what it resolved to, or
// null when there is nothing to write to (a non-DOM context).
export function applyTheme(theme, root = globalThis.document && globalThis.document.documentElement, osPrefersDark) {
  if (!root || !root.setAttribute) return null;
  // The OS answer can be passed in, because a test runner's `matchMedia` is not
  // the machine the user is looking at.
  const name = osPrefersDark === undefined ? themeName(theme) : themeName(theme, osPrefersDark);
  root.setAttribute('data-sd-theme', name);
  return name;
}
