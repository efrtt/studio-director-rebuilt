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
// a browser. What is decided here needs nothing but the two verdicts.

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

export function hasReadyView(model) {
  return !!model && READY.some((key) => !!model[key]);
}
