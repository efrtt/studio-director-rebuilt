// Searching the jump palette: one flat list in, the rows to draw out.
//
// The palette is a command menu, not a fuzzy search: the query is matched as a
// substring against the label, the page code and the menu it lives on, and the
// results are grouped by menu so a row's origin is visible. Groups keep the
// catalogue's order, which is the order the crawl found the links in — the app's
// own order, which is somebody's idea of a workflow.
//
// Kept out of the component so it can be tested without a DOM, and so the
// palette and any future "search this page" box rank things the same way.

export const JUMP_LIMIT = 12;

export function matches(entry, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = (entry.label + ' ' + entry.code + ' ' + (entry.menu || '')).toLowerCase();
  // Every word has to appear, in any order: "reg fee" finds Manage reg fee rules.
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

// Rows for the open palette. With no query it offers recents first, then the
// menu the page you are on belongs to, so Enter does something sensible before
// anything is typed.
export function rowsFor(catalog, query, options = {}) {
  const limit = options.limit || JUMP_LIMIT;
  const recent = options.recent || [];
  const here = options.here || '';

  if (!String(query || '').trim()) {
    const out = [];
    if (recent.length) out.push({ menu: 'Recent', rows: recent.slice(0, limit) });
    if (here) {
      const near = catalog.filter((e) => e.menu === here).slice(0, limit - recent.length);
      if (near.length) out.push({ menu: here, rows: near });
    }
    if (!out.length) {
      // No history and no page context: show the first menu rather than nothing.
      const first = catalog.slice(0, limit);
      if (first.length) out.push({ menu: 'All destinations', rows: first });
    }
    return out;
  }

  const hits = catalog.filter((entry) => matches(entry, query)).slice(0, limit);
  const groups = [];
  for (const entry of hits) {
    const name = entry.menu || 'Other';
    let group = groups.find((g) => g.menu === name);
    if (!group) groups.push((group = { menu: name, rows: [] }));
    group.rows.push(entry);
  }
  return groups;
}

// Every row in drawing order, because the keyboard moves through them flat.
export function flatRows(groups) {
  return groups.reduce((out, group) => out.concat(group.rows), []);
}

// Where the selection goes after an arrow key. Wrapping is deliberate: the
// palette is short and the last row is one press from the first.
export function step(index, total, delta) {
  if (!total) return -1;
  if (index < 0) return delta > 0 ? 0 : total - 1;
  return (index + delta + total) % total;
}
