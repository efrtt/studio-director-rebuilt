// The pages that pair a form with a list of records, read as data.
//
// Measured live on `ManageVendors` (2026-11-02): the page prints the vendor form
// in one cell and "Existing Vendors" in the other, and every one of those rows is
// a plain link to the *same page* with a record parameter added:
//
//   admin.sd?page=ManageVendors&meth=edit&vendor_ident=1792596581894
//
// "New" is the same idea: `admin.sd?page=ManageVendors&meth=neu`. Save is the
// app's own form POST (`StudioDir.onSubmitToMethod('ManageVendors','save')`) and
// it answers with a bare `admin.sd` page that says "test has been updated." with
// the same list under it. Seasons (`NewEditArchive&content=SeasonContent`) and
// holidays (`ManageHolidays`) follow the same three URLs, so the rebuild can use
// one rule for all of them:
//
//   the list is the page; Edit and New are the app's own URLs; the form is drawn
//   over the list when the URL is an edit or a new page.
//
// Nothing here fetches or builds a request. It decides *when* the overlay is on
// and which link each row and button points at, so the app keeps owning the
// navigation and the save.

import { NAV_PARAMS, pageName, recordParams } from './shell.js';
import { recordCellOf } from '../model/regions.js';
import { hasRows } from '../model/rows.js';

// Query keys the app uses to draw a screen rather than to name a record: the page
// navigation `shell.js` already names, plus `content`, which picks which form a
// `NewEditArchive` page shows — dropping it would land on a broken URL — and
// `state`, the archive pages' spelling of New.
const KEEP = new Set([...NAV_PARAMS, 'content', 'state']);

function paramsOf(url) {
  try {
    return new URL(url || '', 'http://x/').searchParams;
  } catch (err) {
    return new URLSearchParams('');
  }
}

// 'new' | 'edit' | 'none'.
//
// `meth=neu` is the app's spelling of New (it is Spanish for "new", not a typo to
// correct). Any other record parameter means the page is showing one record.
export function modeOf(url) {
  const params = paramsOf(url);
  const meth = String(params.get('meth') || '').toLowerCase();
  if (meth === 'neu') return 'new';
  if (meth) return 'edit';
  // The archive pages (`NewEditArchive&content=…`, `NewEditDel&content=…`) spell
  // New as `state=new` instead of `meth=neu`: the same empty form beside the same
  // list. Read as a record parameter it made the add page an edit of nothing, so
  // the dialog announced "Editing" over a new season.
  if (String(params.get('state') || '').toLowerCase() === 'new') return 'new';
  // `content` and the calendar's own parameters say which form to draw, not
  // which record is open: the seasons list is
  // `NewEditArchive&content=SeasonContent` with no record of its own, and it has
  // to stay a list. Modes are decided from the URL, so this is where that line
  // is drawn.
  return extraParams(url).length ? 'edit' : 'none';
}

function extraParams(url) {
  return recordParams(url).filter((key) => !KEEP.has(String(key).toLowerCase()));
}

// The record's own edit URL, when a row carries one.
// A row is a record when one of its cells links back to the same page with a
// parameter added — that is what every one of these lists does, and it is why
// `EditFamily`, whose rows link elsewhere, is never treated as a record list.
export function isRecordHref(href, url) {
  if (!href) return false;
  const here = pageName(url);
  const there = pageName(href);
  if (here && there && here !== there) return false;
  return extraParams(href).length > 0;
}

// The list side of a page: the first table whose rows are records.
// Returns `{ block, rows }` where each row keeps its own cells and the href that
// opens it, or null when the page has no such table.
export function recordsOf(source, url) {
  const tables = (source && source.tables) || [];
  for (const block of tables) {
    if (!hasRows(block)) continue;
    const rows = [];
    for (const cells of block.rows) {
      // The row's own record cell, found by the shared judge, then confirmed to
      // be a link back to this page: a row that names no record is not one.
      const named = recordCellOf(cells);
      const cell = named && isRecordHref(named.href, url) ? named : null;
      // The app's own list opens with an unlabelled placeholder row
      // (`vendor_ident=0` and no text). It is a slot, not a record, and drawing
      // it put an empty line at the top of the list to click into.
      if (cell && String(cell.text || '').trim()) {
        rows.push({ cells, href: cell.href, label: cell.text, id: recordIdOf(cell.href) });
      }
    }
    if (rows.length) return { block, rows };
  }
  return null;
}

function recordIdOf(href) {
  try {
    const params = new URL(href, 'http://x/').searchParams;
    for (const [key, value] of params) {
      // `meth=edit` is the verb, not the record: the id is the parameter after it.
      const name = key.toLowerCase();
      if (name !== 'meth' && !KEEP.has(name) && value) return value;
    }
  } catch (err) { /* not a url */ }
  return '';
}

// The page without the record parameters: where Cancel goes, and where a save
// lands after the app has answered.
export function listHrefOf(url, newHref) {
  const base = newHref || url;
  try {
    const out = new URL(base, 'http://x/');
    for (const key of Array.from(out.searchParams.keys())) {
      if (!KEEP.has(key.toLowerCase())) out.searchParams.delete(key);
    }
    // `state` is the verb (`new`, `edit`), not part of the address a list lives
    // at: the seasons list is `content=SeasonContent` with no state at all. Left
    // in, closing the add dialog rewrote the address bar back to `state=new`, so
    // a reload reopened the dialog you had just dismissed.
    out.searchParams.delete('state');
    if (!newHref) {
      // A record URL with no New link beside it still names its page.
      const page = pageName(url);
      if (page && !out.searchParams.get('page')) out.searchParams.set('page', page);
    }
    return out.pathname + out.search;
  } catch (err) {
    return url || '';
  }
}

// The page's own New control, wherever it printed it: `a#new` in the top bar on
// ManageVendors and ManageHolidays, an "Add" link in the bar on other pages.
export function newHrefOf(source) {
  // Where the app prints New varies by page: a bar control on ManageVendors,
  // and on the same page read as a task it is one of the page's own links.
  const candidates = [
    // The button bar first: measured live, `ManageVendors` prints `a#new` there,
    // and the add page prints no bar at all because it already *is* the add form.
    ...((source && source.bar && source.bar.items) || []),
    ...((source && source.actions) || []),
    ...((source && source.bar && source.bar.items) || []),
    ...((source && source.bar && source.bar.menu) || []),
    ...((source && source.links) || [])
  ];
  const named = candidates.find((a) => a && String(a.id || '').toLowerCase() === 'new' && a.href);
  if (named) return named.href;
  const labelled = candidates.find((a) => a && a.href && /^(new|add|create)\b/i.test(String(a.label || '').trim()));
  return labelled ? labelled.href : '';
}

// Is the form on this page the *add* form, already empty?
//
// The app's add screen is the list page itself: `ManageVendors` with no record
// parameter prints the empty form beside the list, and its Save adds a record.
// So New does not have to navigate anywhere on those pages — it opens the form
// that is already there, which is exactly what the original does.
export function blankFormOf(source) {
  const fields = (source && source.fields) || [];
  if (!fields.length) return false;
  return fields.every((field) => {
    if (!field) return true;
    // Only text someone could have typed counts. `ManageHolidays` arrives with
    // "Charge Tuition" already set to No and empty date pickers, and that is
    // still the add form — it is what the app's own page submits.
    if (field.type === 'checkbox' || field.options) return true;
    return !String(field.value == null ? '' : field.value).trim();
  });
}

// The id of the record this URL names, so the row it came from can stay marked.
// Comparing raw substrings was wrong the first time: "vendor_ident=2" contains
// the "1" of "127.0.0.1", and the wrong row got the highlight.
export function openIdOf(url) {
  const names = extraParams(url).filter((key) => String(key).toLowerCase() !== 'meth');
  for (const key of names) {
    const value = paramsOf(url).get(key);
    if (value) return value;
  }
  return '';
}

// How wide the form should be drawn. The count is the page's own fields, so a
// four-field holiday gets a small dialog and the fourteen-field vendor record
// gets the wide one without a per-page table of sizes.
export function widthOf(fieldCount) {
  if (!fieldCount || fieldCount <= 6) return 'narrow';
  return fieldCount <= 10 ? 'mid' : 'wide';
}

// What the dialog says it is doing, from what the page holds.
export function headingOf(mode, title) {
  const name = String(title || '').trim();
  if (mode === 'new') {
    // "Manage Vendors" is the page; the thing being created is a vendor.
    const base = name.replace(/^manage\s+/i, '').replace(/ies$/i, 'y').replace(/s$/i, '');
    return { eyebrow: 'New', title: `New ${(base || 'record').toLowerCase()}` };
  }
  return { eyebrow: 'Editing', title: name || 'Edit record' };
}

// What one of these records is called, in the page's own words: "Manage
// Vendors" holds vendors, "Manage Holidays" holds holidays. Used for the count
// and the New button, so neither has to say "record" where the page says what it
// is.
export function labelOf(title) {
  const base = String(title || '')
    .replace(/^manage\s+/i, '')
    .replace(/ies$/i, 'y')
    .replace(/s$/i, '')
    .trim()
    .toLowerCase();
  return base || 'record';
}

// Where Cancel goes, when the URL cannot be trusted to say.
//
// Dropping the record parameters is a guess about the app's routing, and on the
// archive pages (`NewEditArchive&content=…`) it is a wrong one: the stripped URL
// is not a screen the server draws, so Cancel landed on an error page. The
// browser already knows the answer — the page the click came from — so the
// referrer wins whenever it is another URL of the same script, and the computed
// list URL is only the fallback.
export function backHrefOf(url, referrer, fallback) {
  try {
    const here = new URL(url || '', 'http://x/');
    const from = new URL(referrer || '', 'http://x/');
    const name = here.pathname.split('/').pop();
    const cameFrom = from.pathname.split('/').pop();
    if (!referrer || !name || cameFrom !== name) return fallback || '';
    // A reload names itself; that is not somewhere to go back to.
    if (from.pathname + from.search === here.pathname + here.search) return fallback || '';
    return from.pathname + from.search;
  } catch (err) {
    return fallback || '';
  }
}
