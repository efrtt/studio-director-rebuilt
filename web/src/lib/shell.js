// Everything that is true of every page, and nothing that is true of one.
//
// The shell below is taken from live dumps of the app:
//
//   form#idForm > .topBarContainer + .standardMainContent
//   .standardMainContent > #sideNavBar (a.sideNavLink ...) + #mainContent
//   #mainContent > .contentContainer > .Content > .formTitle / .contentInfo

import { SHELL, CONTENT, LOGIN, LOGIN_FORM, RAIL_LINK, PAGE_TITLE } from '../model/appdom.js';

export function parseHtml(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

export function textOf(node) {
  if (!node) return '';
  return String(node.textContent || '').replace(/\s+/g, ' ').trim();
}

export function qs(root, sel) {
  return root ? root.querySelector(sel) : null;
}

export function qsa(root, sel) {
  return root ? Array.from(root.querySelectorAll(sel)) : [];
}

export function pageName(href) {
  try {
    return new URL(href, 'http://x/').searchParams.get('page') || '';
  } catch (e) {
    return '';
  }
}

// The app navigates with `?page=<name>&clicktab=<tab>`, the record list filters
// client-side with `filter`, and global search puts the query in `searchText`.
// Any *other* query parameter means the page is showing one specific record: the
// calendar's own links look like `admin.sd?page=EditClass&cident=…`, and a list
// item's link takes the same shape. Keys are compared lower-cased because the
// app's own casing is not consistent (`searchText`).
// `sdprobe` belongs here too: it is this build's own switch (see probe.js), and
// a page visited with `?sdprobe=1` was routed as a record page because the flag
// looked exactly like `fident=…`. Measured live: with the probe armed, the
// calendar and ChargesHome both mounted from a fetched copy, because
// `mountRecord` owned them.
//
// The calendar's `SEASON`, `DATESPEC_VIEW` and `DATESPEC_VIEW_DATE` are the same
// kind of thing: they say which week or season to draw, not which record you are
// editing. Left out, every dated calendar URL was a "record page", and its
// compact week grid was read as a data table instead of as a calendar.
const NAV_PARAMS = new Set([
  'page', 'clicktab', 'filter', 'searchtext', 'sdprobe',
  'season', 'datespec_view', 'datespec_view_date',
  // The Home dashboard's own tabs (`?page=HomePage&tab=tab-insights`). A tab is
  // a view of one page, not a record: left out, every dashboard tab was a
  // "record page" and was never rebuilt.
  'tab'
]);

function isNavParam(key) {
  return NAV_PARAMS.has(String(key).toLowerCase());
}

export function recordParams(href) {
  try {
    const url = new URL(href, 'http://x/');
    const out = [];
    for (const [key, value] of url.searchParams) {
      if (!isNavParam(key) && value !== '') out.push(key);
    }
    return out;
  } catch (e) {
    return [];
  }
}

// The value of the record parameter, so the list can mark the row you are on.
export function recordId(href) {
  try {
    const url = new URL(href, 'http://x/');
    for (const [key, value] of url.searchParams) {
      if (!isNavParam(key) && value !== '') return value;
    }
  } catch (e) { /* not a url */ }
  return '';
}

// A page that is editing one record is handed back to the app untouched: it is
// the editor, and covering a form with the list is how you end up unable to
// edit anything. `EditClass`-style page names count even without a parameter.
// A `.formTitle` that holds an advisory block *and* the page's own name.
//
// `NewEditArchive(content=SeasonContent)` prints
// `<div class="formTitle"><h4>Do NOT add a season here…</h4>Seasons</div>`: the
// block is a warning, and the name of the page comes after it. Reading the div
// as one string put that warning into the dialog's title, a paragraph where a
// title belongs. The title is the text belonging to the div itself; a div with
// no text of its own (a plain `<b>Manage Vendors</b>`) still reads as a whole.
export function titledTextOf(el) {
  if (!el) return '';
  const own = Array.from(el.childNodes || [])
    .filter((node) => node.nodeType === 3)
    .map((node) => String(node.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
  return own || textOf(el);
}

export function isRecordPage(href) {
  if (recordParams(href).length) return true;
  return /^Edit/i.test(pageName(href));
}

export function titleOf(doc) {
  return textOf(qs(doc, PAGE_TITLE));
}

// The sign-in screen is never replaced: that is where the session is created.
export function isLoginPage(doc) {
  const form = qs(doc, LOGIN_FORM);
  if (form && /login\.sd/i.test(form.getAttribute('action') || '')) return true;
  return !!qs(doc, LOGIN);
}

export function hasShell(doc) {
  return !!qs(doc, SHELL);
}

// Is there nothing on this page a reader could claim? Asked of the *live*
// document, before deciding whether a GET is worth paying for: a page that
// arrived empty and is filled in by the app's own script looks like this until
// that script runs, and "nothing yet" is exactly when the fetched copy is worth
// reading. A page that has a content root and text in it is a screen this build
// either reads now or leaves alone — fetching it again would return the same
// thing the browser already has.
export function liveIsBare(doc) {
  if (!doc) return true;
  // Our own overlay is in the tree once a view is mounted; it is not content.
  if (qs(doc, '#sd-root')) return true;
  const root = qs(doc, CONTENT);
  if (!root) return true;
  return !root.querySelector('table tr, input, select, textarea, a[href], p');
}

// The app prints each rail label twice ("HomeHome", "Class CalendarClass
// Calendar"), so a label that is exactly its own second half is folded back.
export function oneLabel(label) {
  const s = String(label || '').trim();
  const n = s.length;
  if (n >= 4 && n % 2 === 0 && s.slice(0, n / 2) === s.slice(n / 2)) return s.slice(0, n / 2).trim();
  return s;
}

export function railLinks(doc) {
  const out = [];
  const seen = new Set();
  for (const a of qsa(doc, RAIL_LINK)) {
    const href = a.getAttribute('href') || '';
    const label = oneLabel(textOf(a));
    if (!href || !label) continue;
    const key = pageName(href) || href;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, href });
  }
  return out;
}

export class SessionExpired extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpired';
  }
}

// One same-origin GET, with the browser's own cookies. No credentials are read,
// stored or sent anywhere else.
export async function fetchPage(url) {
  let res;
  try {
    res = await fetch(url, { credentials: 'same-origin', redirect: 'follow' });
  } catch (err) {
    throw new Error('Network error: ' + (err && err.message ? err.message : String(err)));
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const html = await res.text();
  const doc = parseHtml(html);
  if (isLoginPage(doc)) throw new SessionExpired();
  return { doc, finalUrl: res.url || url };
}
