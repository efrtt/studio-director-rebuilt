// Probe mode: what the app actually draws.
//
// The crawl fetches HTML and never runs the app's JavaScript, so a screen whose
// form is built after load looks exactly like a screen that is only a sentence.
// Two attempts to settle that from the outside both failed: loading those pages
// in same-origin iframes saturates the page's main thread until the tab stops
// answering, and fetching them in parallel gets 447-byte stubs back instead of
// pages (56 of 61 in one sweep; the same four URLs returned 7–8 kB when read one
// at a time).
//
// So the measurement is taken where the app runs. Visit a screen with
// `?sdprobe=1` — or once with the flag stored — and this records what was on the
// page: controls, buttons, table rows, links and text length. `sdProbe.dump()`
// then returns every screen seen, as JSON — published on `window` while the
// probe is armed, because the bundle is function-scoped inside the userscript's
// wrapper and `SD` is not reachable from a console.
//
// Read-only: it counts elements and writes to localStorage. It never presses a
// control, never requests a URL, and never touches the page it measures.
//
// A second look is taken 2.5 s after the first because some screens are drawn
// after load; `record` keeps the maximum of each count across visits, so the
// later look only ever raises a number, never lowers it.

const FLAG = 'sd.probe';
const LOG = 'sd.probe.log';
const PARAM = 'sdprobe';
const LOOK_AGAIN = 2500;

// localStorage throws in private mode and is absent in a strict context: a
// probe that cannot store anything must not break the page it is measuring.
export function storageOrNull(store) {
  if (store) return store;
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.setItem('__sd_probe__', '1');
    s.removeItem('__sd_probe__');
    return s;
  } catch (e) {
    return null;
  }
}

// `?sdprobe=1` turns it on for the rest of the session, `?sdprobe=0` turns it
// off and forgets the log's flag. No parameter means "as last set".
export function probeEnabled(href, store) {
  const s = storageOrNull(store);
  let params = null;
  try {
    params = new URL(href || '', 'http://x/').searchParams;
  } catch (e) {
    params = null;
  }
  const flag = params ? params.get(PARAM) : null;
  if (flag === '1') {
    if (s) try { s.setItem(FLAG, '1'); } catch (e) { /* full or blocked */ }
    return true;
  }
  if (flag === '0') {
    if (s) try { s.removeItem(FLAG); } catch (e) { /* blocked */ }
    return false;
  }
  return !!(s && s.getItem(FLAG) === '1');
}

import { contentRoot } from '../model/root.js';
import { shownRowCount } from '../model/regions.js';
import { PAGE_TITLE } from '../model/appdom.js';

// The crawl's own naming: `EmailClass(cident)`, `Enroll(cident,sident)`. The
// navigation parameters are the ones the shape deliberately ignores — and so is
// `sdprobe`, which is this reader's own switch and not part of the screen.
const NAV = new Set(['page', 'clicktab', 'filter', 'searchtext', 'sdprobe']);

export function shapeOf(href) {
  let url;
  try {
    url = new URL(href || '', 'http://x/');
  } catch (e) {
    return '';
  }
  const page = url.searchParams.get('page') || '';
  const keys = [];
  for (const [key, value] of url.searchParams) {
    if (!NAV.has(String(key).toLowerCase()) && value !== '') keys.push(key);
  }
  return keys.length ? `${page}(${keys.join(',')})` : page;
}

// What the page is, right now, in the numbers that decide which reader owns it.
export function measure(doc) {
  // The page's content root, resolved where every reader resolves it: the probe
  // measures the same screen the readers read, including a print window's body.
  const root = contentRoot(doc);
  const count = (sel) => (root ? root.querySelectorAll(sel).length : 0);
  // Rows are the page's record rows, judged by the shared classifier — the same
  // number the readers route on, not a raw `tr` count kept here.
  const rows = shownRowCount(doc);
  const titleEl = doc.querySelector(PAGE_TITLE);
  const text = root ? String(root.textContent || '').replace(/\s+/g, ' ').trim() : '';
  return {
    controls: count('input, select, textarea'),
    buttons: count('button, a.Btn, a.BtnOutln, a[onclick]'),
    rows,
    links: count('a[href]'),
    text: text.length,
    title: titleEl ? String(titleEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) : ''
  };
}

function readLog(s) {
  try {
    const raw = s.getItem(LOG);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    return {};
  }
}

// One entry per screen shape, not per visit: the counts are the maximum seen,
// so a second visit (or the delayed look) can only add information.
export function record(entry, store) {
  const s = storageOrNull(store);
  if (!s || !entry || !entry.shape) return null;
  const log = readLog(s);
  const prev = log[entry.shape] || null;
  const high = (key) => Math.max(prev ? prev[key] || 0 : 0, entry[key] || 0);
  const next = {
    shape: entry.shape,
    title: entry.title || (prev ? prev.title : '') || '',
    url: entry.url || (prev ? prev.url : '') || '',
    samples: (prev ? prev.samples || 0 : 0) + 1,
    controls: high('controls'),
    buttons: high('buttons'),
    rows: high('rows'),
    links: high('links'),
    text: high('text'),
    // The routing verdict is `recordView`'s, and this function rebuilds the entry from
    // scratch on every look. Without carrying the two fields forward the 2.5 s second
    // look erased the verdict a moment after it was recorded, which is why every screen
    // in the log read `view: null` even on pages that mounted from the live document.
    view: prev ? prev.view || null : null,
    source: prev ? prev.source || '' : ''
  };
  log[entry.shape] = next;
  try {
    s.setItem(LOG, JSON.stringify(log));
  } catch (e) {
    return null;
  }
  return next;
}

// The routing outcome, recorded beside the measurement: which view the rebuild
// actually mounted for this shape, and where the screen came from ('fetched',
// 'live', or 'app' when it declined to cover the page at all).
//
// This is the other half of the question the crawl cannot answer. `measure` says
// what the page contained; this says what this build did about it — so a walk
// over nine screens leaves nine verdicts in the log instead of nine impressions.
//
export function recordView(view, source, store) {
  const s = storageOrNull(store);
  if (!s) return null;
  const href = (globalThis.location && globalThis.location.href) || '';
  if (!probeEnabled(href, s)) return null;

  const shape = shapeOf(href);
  const log = readLog(s);
  const prev = log[shape] || {
    shape, title: '', url: href, samples: 0, controls: 0, buttons: 0, rows: 0, links: 0, text: 0
  };
  log[shape] = { ...prev, view: view || null, source: source || '', url: href };
  try {
    s.setItem(LOG, JSON.stringify(log));
  } catch (e) {
    return null;
  }
  return log[shape];
}

export function dump(store) {
  const s = storageOrNull(store);
  return JSON.stringify(s ? readLog(s) : {}, null, 2);
}

export function clear(store) {
  const s = storageOrNull(store);
  if (!s) return;
  try {
    s.removeItem(LOG);
  } catch (e) { /* blocked */ }
}

// Called once per page load, before the rebuilt UI is put in front of the page:
// after that the original content is covered, so this has to be now.
export function probeTick(doc, href) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!d) return null;
  const url = href || (globalThis.location && globalThis.location.href) || '';
  if (!probeEnabled(url)) return null;
  if (globalThis.__sdProbeTick) return null;
  globalThis.__sdProbeTick = true;

  // The userscript wraps the bundle in an IIFE, so its `SD` namespace is local
  // to that function and cannot be typed into a console. A probe nobody can read
  // is useless, so it publishes its own handle on `window` while armed.
  globalThis.sdProbe = {
    dump: () => dump(),
    clear: () => clear(),
    log: () => JSON.parse(dump())
  };

  const shape = shapeOf(url);
  const take = () => record({ shape, url, ...measure(d) });
  take();
  const timer = setTimeout(take, LOOK_AGAIN);
  if (timer && typeof timer.unref === 'function') timer.unref();
  return shape;
}
