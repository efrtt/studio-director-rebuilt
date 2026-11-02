// What this browser has actually used, so "Most used" can be true.
//
// The mockups ranked destinations by hand; a real build cannot. The app never
// tells us which of its menus people open, so the only honest source is this
// build's own history: a click on one of its links, counted locally. A page with
// no history shows no "Most used" row at all, rather than inventing one.
//
// Storage is injected rather than read from `window`, so the ranking is a pure
// function that a test can drive with a map. Nothing leaves the machine: no
// network, no identifiers, and no names of students, families or balances — only
// the destination's own href.

export const USAGE_KEY = 'sd.usage.v1';
export const RECENT_KEY = 'sd.jump.recent.v1';
export const RECENT_MAX = 4;
export const USED_MAX = 5;

// A link's key is its href without the app's per-link `clicktab`, so the same
// destination reached from two pages is one entry.
export function keyOf(href) {
  return String(href || '').replace(/[?&]clicktab=\d+/g, '').replace(/[?&]$/, '');
}

function parse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : fallback;
  } catch (err) {
    return fallback;
  }
}

export function readUsage(storage) {
  if (!storage) return {};
  const value = parse(storage.getItem(USAGE_KEY), {});
  const out = {};
  for (const [href, count] of Object.entries(value)) {
    if (typeof count === 'number' && count > 0) out[href] = count;
  }
  return out;
}

// Counts one visit and returns the new map. A failed write (private mode, a full
// quota) must not break the click that caused it, so writes are best-effort.
export function recordUse(storage, href) {
  const key = keyOf(href);
  if (!key || !storage) return {};
  const usage = readUsage(storage);
  usage[key] = (usage[key] || 0) + 1;
  try {
    storage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch (err) { /* the click still works */ }
  return usage;
}

export function readRecent(storage) {
  if (!storage) return [];
  const value = parse(storage.getItem(RECENT_KEY), []);
  return Array.isArray(value) ? value.filter((h) => typeof h === 'string' && h) : [];
}

export function recordRecent(storage, href, entry) {
  const key = keyOf(href);
  if (!key || !storage) return [];
  const list = readRecent(storage).filter((h) => h !== key);
  list.unshift(key);
  const kept = list.slice(0, RECENT_MAX);
  try {
    storage.setItem(RECENT_KEY, JSON.stringify(kept));
    if (entry) {
      // Recents are hrefs; the label is looked up in the catalogue, so a rename
      // in a later crawl shows the new name rather than a stale one.
      storage.setItem(RECENT_KEY + '.labels', JSON.stringify({}));
    }
  } catch (err) { /* best effort */ }
  return kept;
}

// The most-used destinations of the page you are on, in count order. Ties fall
// back to the order the page prints them, so the row is stable between visits.
export function topUsed(usage, items, limit = USED_MAX) {
  const scores = new Map();
  items.forEach((item, i) => {
    const count = usage[keyOf(item.href)] || 0;
    if (count > 0) scores.set(keyOf(item.href), { item, count, i });
  });
  return Array.from(scores.values())
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .slice(0, limit)
    .map((row) => row.item);
}

// Which of these hrefs have been visited, in recency order.
export function recentAmong(recent, items) {
  const byHref = new Map(items.map((item) => [keyOf(item.href), item]));
  const out = [];
  for (const href of recent) {
    const item = byHref.get(href);
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}

// localStorage throws in some embedded contexts; a missing store means no
// history, never a broken page.
export function browserStore() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = 'sd.store.probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch (err) {
    return null;
  }
}
