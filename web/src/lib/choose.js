// Which reading gets mounted: the fetched copy, the live page, or neither.
//
// main.js used to decide this inline, in the middle of its mounting code, where
// no test could reach it — and it is the decision that took 11 of the 61 notice
// shapes to get right. Two rules, both about a page the server sent empty:
//
//   a note is only trusted when the live page agrees with it;
//   a page with no view at all gets one more look, if it carries a form.
//
// Splitting it out is not tidiness. It is the difference between a rewrite
// diffing this behaviour and a rewrite guessing at it.
//
// Deliberately pure: the DOM reading that feeds it (`contradictsNote` on a live
// document, `readLiveView`'s polling) stays in main.js, because that part needs
// a browser. What is decided here needs nothing but the verdicts.

// Is a second look at the browser worth taking? False means mount the fetched
// model as it stands, which is the common case and costs nothing.
export function wantsLiveLook({ fetchedView, contradicts = false, hasForm = false }) {
  if (fetchedView === 'note') return !!contradicts;
  if (!fetchedView) return !!hasForm;
  return false;
}

// With the second look done, where does the screen come from?
//
// `source: 'app'` is the honest answer for a contradicted note that no reader
// claims: there is nothing to mount that would be true, so the app keeps its
// page. `source: 'fetched'` with `state: 'none'` is the old behaviour for a page
// that neither reading could read — the overlay says so instead of pretending.
export function decideMount({ fetchedView, liveView = null }) {
  if (fetchedView === 'note') {
    return liveView
      ? { source: 'live', why: 'the live page is not a notice' }
      : { source: 'app', why: 'contradicted, and no reader claims the live page' };
  }

  if (!fetchedView) {
    return liveView
      ? { source: 'live', why: 'the fetched copy had no view, the live page does' }
      : { source: 'fetched', state: 'none', why: 'no view in either reading' };
  }

  return { source: 'fetched', why: 'the fetched copy answered' };
}

// Where a page's model should be read from, as one decision.
//
// `live` when the browser already shows something a reader claims — that is the
// whole point of preferring it: no second GET, no second parse, and the model
// describes the same tree the edits will be written into.
//
// `fetch` only when the live read found nothing AND the page is one the server
// was supposed to fill in: a shell with no content, or a screen that arrives
// empty and is drawn by script. `app` when the live page simply is what it is —
// a page this build has nothing to say about.
export function chooseSource({ liveView = null, liveHasShell = true, liveIsEmpty = false } = {}) {
  if (liveView) return 'live';
  if (!liveHasShell || liveIsEmpty) return 'fetch';
  return 'app';
}

// A print window has no shell at all: no rail, no top bar, often no `form#idForm`
// (`PrintClassRoster` was dumped and has none). It is still a screen worth
// rebuilding when a reader claims it **and** the page names itself; otherwise
// "no view" is the honest answer, because a print popup with no title and no
// table is not something to cover with an overlay.
export function decideShellLess({ hasSheet, hasTitle }) {
  return hasSheet && hasTitle ? 'sheet' : 'none';
}

// Which views end the live re-read's wait.
//
// A note is deliberately absent from this set. If the live page still reads as a
// note, this build has nothing better to say about it than the fetched copy did,
// so waiting longer only delays the answer — and for a page the app fills in by
// script, the answer is usually that another reader now claims it.
const READY = ['task', 'settings', 'sheet', 'list', 'index', 'week'];

// A search results screen, as opposed to the record panel left over from the
// page the search started on.
//
// Measured on the live app: a global search navigates to
// `admin.sd?page=SearchResults&searchText=…`, but the old page's panel is still
// in the document while the app draws the results. The first reading therefore
// describes the list you were already looking at, which is why a search started
// from Families or Students appeared to do nothing.
//
// The app titles the results page "Search Results for …"; a record panel says
// "Families" or "2114 Items". Asking for the title, rather than for "a list",
// is the difference between reading the results and reading the leftovers.
export function looksLikeSearchResults(model) {
  if (!model || !model.list) return false;
  const named = String(model.list.label || '') + ' ' + String(model.list.title || '');
  return /search\s*results/i.test(named);
}

// Has the search route's page finished showing *its* results?
//
// The app writes the new title first and the rows a moment later, so a reading
// taken in between is the previous page's panel wearing the results title. Two
// things end the wait: a panel that has reached its own total (31 of 31), or a
// panel whose total is no longer the one first seen (the app redrew it).
export function searchSettled(model, first) {
  if (!model || !model.list) return false;

  const items = model.list.items.length;
  const total = model.list.total;
  if (total != null && items >= total) return true;

  const before = first && first.list ? first.list.total : null;
  if (before != null && total != null && total !== before) return true;

  return false;
}

// The first record a panel shows, as one string. Two readings with the same
// total *and* the same first record are the same record set: the app filling a
// carried-over panel appends rows without changing either.
function firstRecordOf(list) {
  const item = list && Array.isArray(list.items) ? list.items[0] : null;
  if (!item) return '';
  return String(item.href || '') + '|' + String(item.label || '');
}

// Is this reading still the panel the page arrived with?
//
// The results page is served carrying the record panel of the page the search
// started on, and the app finishes filling that panel *before* it draws the
// results. So "items reached total" is not proof of anything: a 4272-record
// Students panel completes itself while the search is still in flight, and the
// wait ended on it — the list you were already looking at, under a search URL.
// The results are a different record set, so the first record or the total
// changes when they land; a panel that keeps its own first record is still the
// page it arrived from.
export function sameRecordSet(a, b) {
  if (!a || !b) return false;
  if (a.total == null || b.total == null || a.total !== b.total) return false;
  // An empty panel is not a record set: a search that found nothing has nothing
  // in common with whatever the page arrived carrying, and must not be made to
  // wait for a change that will never come.
  if (!Array.isArray(a.items) || !a.items.length) return false;
  if (!Array.isArray(b.items) || !b.items.length) return false;
  return firstRecordOf(a) === firstRecordOf(b);
}

// Has the search route's page finished showing *its* results?
//
// Three things, in order: the page names itself as the results, the panel is
// complete, and the panel is no longer the record set the page arrived with.
// The last is what a search started from a list page needs — that page's own
// panel reaches its total too.
export function searchReady(model, first) {
  if (!looksLikeSearchResults(model)) return false;
  const list = model.list;
  if (!list) return false;
  // The panel the page arrived with is still on screen: the app fills that panel
  // to its own total before it draws the results, so waiting longer is right.
  if (sameRecordSet(list, first ? first.list : null)) return false;
  // Nothing drawn yet. An empty panel that states 0 is the answer; one that says
  // nothing at all is the shell the results have not been written into.
  if (!Array.isArray(list.items) || !list.items.length) return list.total === 0;
  // Rows of a record set the page did not arrive with: the results, however many
  // of them the app has drawn so far. The list follows the rest itself (a
  // standalone list is `auto`), so the screen does not wait for the last row.
  return true;
}

export function hasReadyView(model) {
  return !!model && READY.some((key) => !!model[key]);
}
