// Whether the rail is folded away, and where that choice is kept.
//
// The rail is 216px of a 1280px window for about ten links, so it folds to a
// 56px strip of initials. The preference is remembered the same way the colour
// scheme is: one key, read and written defensively, never breaking a mount.

const KEY = 'sd.rail';

function store() {
  try {
    return globalThis.localStorage || null;
  } catch (e) {
    // Private mode, or a context without storage: the choice is simply not kept.
    return null;
  }
}

export function readRail(s = store()) {
  try {
    return !!s && s.getItem(KEY) === 'collapsed';
  } catch (e) {
    return false;
  }
}

export function writeRail(collapsed, s = store()) {
  try {
    if (!s) return false;
    s.setItem(KEY, collapsed ? 'collapsed' : 'open');
    return true;
  } catch (e) {
    return false;
  }
}
