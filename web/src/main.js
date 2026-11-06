import App from './App.svelte';
import { injectStyles, removeStyles } from './lib/styles.js';
// The sign-in page is the one screen we do not rebuild — it is where the session
// is made — so it gets colour only, in its own <style> the userscript adds to the
// app's own markup. Exported as text because the artefact carries everything.
import FONTS from './fonts.css?inline';
import LOGIN from './login.css?inline';
import { readTheme, applyTheme } from './lib/theme.js';
import {
  fetchPage, liveIsBare, parseHtml, SessionExpired, railLinks
} from './lib/shell.js';
import { routeOf } from './lib/route.js';
import { readList, panelPeek } from './lib/list.js';
import { expandInApp, showAllTrigger } from './lib/expand.js';
import { runSearch } from './lib/search.js';
import { readPeriodControl, choosePeriodInApp } from './lib/period.js';
import { readNavIcons } from './lib/navicons.js';
import { backTarget } from './lib/backlink.js';
import { readMonth } from './lib/month.js';
import { readCalendarNav } from './lib/calnav.js';

// Replaced at build time by vite.config.js.
const VERSION = typeof __SD_VERSION__ !== 'undefined' ? __SD_VERSION__ : 'dev';
import { readPage } from './lib/page.js';
import { hasForm } from './lib/form.js';
import { runReportInApp } from './lib/report.js';
import { runTaskInApp } from './lib/task.js';
import { readSheet } from './lib/sheet.js';
import { markAttendanceInApp, writeAbsenceInApp, writeNotesInApp, pressAttendanceSave } from './lib/attendance.js';
import { readBar } from './lib/bar.js';
import { confirmSubject } from './lib/deletedname.js';
import { saveSettingsInApp } from './lib/settings.js';
import { clickActionInApp } from './lib/actions.js';
import { changesFrom, saveInApp, pageSave } from './lib/save.js';
import { applyOrder, pressLock } from './lib/perf.js';
import { runPayment, addSplitInApp } from './lib/payment.js';
import { unreadNote, unreadOf } from './model/coverage.js';
import { decisionOf } from './model/regions.js';
import { pageShape } from './model/root.js';
import { probeTick, recordView } from './lib/probe.js';
import { contradictsNote } from './lib/note.js';
import { wantsLiveLook, decideMount, decideShellLess, chooseSource, searchReadyOrLate } from './lib/choose.js';
import { readRecordPage } from './lib/record.js';
import { readLiveView } from './lib/live.js';

export { readPage };
// The face has to travel with it: on a mount the fonts are in the same <style> as
// everything else, and the sign-in page gets only this one.
export const loginCss = `${FONTS}\n${LOGIN}`;

// The sign-in page has no shell of its own to carry the colour scheme, and the
// stylesheet's palettes hang off the same attribute: reading the stored choice
// here means the page before the app arrives in the look the app will be in.
// `auto` resolves the same way it does inside the app.
export function applyLoginTheme(root) {
  return applyTheme(readTheme(), root);
}
// Probe mode's two ends: `probeTick` measures the page before the overlay covers it, and
// `dump` returns every screen measured so far. Neither is reachable from a console as `SD`
// (the bundle is function-scoped inside the userscript wrapper): arm it with `?sdprobe=1`,
// and probe.js publishes `window.sdProbe` with `dump`/`log`/`clear` for that purpose.
// `SD.probeClear()` forgets them. Off unless `?sdprobe=1` has been used.
export { dump as probeDump, clear as probeClear, measure, shapeOf } from './lib/probe.js';

// Pure helper for the demo pages and tests: html in, model out.
export function modelFromHtml(html, url) {
  return readPage(parseHtml(html), url || location.href);
}

let instance = null;

export function mount(opts = {}) {
  if (instance) return instance;

  // Probe mode's second half. `sdProbe.dump()` says what the page contained;
  // this says what this build made of it — the model it drew, with the selectors
  // it will write through — so a live check can ask the reader instead of
  // re-deriving the answer from the markup and then agreeing with itself. Only
  // published while the probe is armed (`?sdprobe=1`); otherwise there is no
  // handle to write to and a production page pays nothing.
  if (globalThis.sdProbe) globalThis.sdProbe.model = opts.model || null;

  injectStyles();
  document.documentElement.classList.add('sd-app');

  const root = document.createElement('div');
  root.id = 'sd-root';
  // Which decision produced this page: the content root and the row judgement,
  // recorded where the parity probe can read it. A dump that cannot name its
  // path cannot tell a real read from a fallback that quietly did the work.
  const stampDecision = () => {
    try {
      const decision = decisionOf(document);
      root.dataset.sdPath = decision.path;
      root.dataset.sdRoot = decision.root;
      root.dataset.sdSource = decision.source;
      root.dataset.sdControls = String(decision.controls);
      root.dataset.sdLinks = String(decision.links);
      root.dataset.sdTables = JSON.stringify(decision.tables);
      root.dataset.sdRows = JSON.stringify(decision.rows);
      root.dataset.sdFallback = decision.fallback;
    } catch (e) { /* a page mid-load still mounts */ }
  };
  stampDecision();
  // The app reveals its tab panels after load; a decision measured at mount can
  // see them still hidden. The probe asks for a fresh stamp against the page as
  // it stands when measured, so "which path decided this" describes that page.
  if (globalThis.sdProbe) globalThis.sdProbe.refreshDecision = stampDecision;
  (opts.container || document.body).appendChild(root);

  const app = new App({
    target: root,
    props: {
      model: opts.model || { nav: [], week: null, list: null, form: null, view: null, title: '', url: location.href },
      state: opts.state || 'ready',
      message: opts.message || '',
      onOriginal: opts.onOriginal || null,
      // Saving goes through the live page, never through the fetched copy.
      onSave: opts.onSave || null,
      // A record page's own buttons: pressed on the live page, never rebuilt.
      onAction: opts.onAction || null,
      // The performance list: the app's own controls, its own lock toggle, and
      // the order written into the app's own hidden inputs before its Save.
      onPerfAct: opts.onPerfAct || null,
      onPerfLock: opts.onPerfLock || null,
      onPerfSave: opts.onPerfSave || null,
      // Same for reports: their run control is on the live page.
      onRun: opts.onRun || null,
      // A task screen's own control: our fields, the app's own button. This was
      // the one handler `mount` never forwarded, so every save on a task page
      // answered "no control to press" — New on the Manage Vendors list, where
      // the add form is the page itself rather than a `meth=neu` record.
      onAct: opts.onAct || null,
      // Attendance's gestures (a tick, a reason, Save), each written into the app's
      // own control. Forwarded here as well, because a handler that `mount` does
      // not pass is a handler no view ever receives.
      onAttend: opts.onAttend || null,
      // Toggle screens: our controls, the app's own Save.
      onSaveSettings: opts.onSaveSettings || null,
      // New Payment: process the payment, and cause a split. Both press the app's
      // own anchors. Forwarded here for the same reason as `onAct` below — a
      // handler this object does not list is a handler no view ever receives,
      // and the split button answered "no handler" while the wiring above it was
      // already correct.
      onSubmitPayment: opts.onSubmitPayment || null,
      onAddSplit: opts.onAddSplit || null,
      onSearch: opts.onSearch || null,
      // Every screen with a control gets a way to press it: the narrower wiring left
      // a dropped student's dialog with a dead button.
      onPress: opts.onPress || ((action) => clickActionInApp(document, action)),
      onRefresh: opts.onRefresh || null,
      // The app's own nav icons, read where they live. Keyed by href, because the
      // rail renders the model's links and the live sidebar is where the <i> is.
      icons: readNavIcons(document),
      version: VERSION,
      // The page that posted the form, so a confirmation can offer the way back.
      back: backTarget(document.referrer, location.href),
      // The calendar's season picker, read on the live page: its options are
      // whole URLs, so switching season is the app's own navigation.
      period: opts.period || null,
      onPeriod: opts.onPeriod || null,
      // The calendar's own Prev / Next / view links, when the page has them.
      nav: opts.nav || null,
      // Widening the record list uses the app's own control on the live page,
      // and only when that page actually has one.
      onLoadAll: opts.onLoadAll || null,
      canLoadAll: !!opts.canLoadAll
    }
  });

  instance = {
    destroy() {
      app.$destroy();
      if (root.parentNode) root.remove();
      removeStyles();
      document.documentElement.classList.remove('sd-app');
      instance = null;
    }
  };
  return instance;
}

export async function autoMount(opts = {}) {
  // Readable from the console as document.documentElement.dataset.sdVersion.
  try { document.documentElement.setAttribute('data-sd-version', VERSION); } catch (e) { /* not a document */ }
  const onOriginal = opts.onOriginal || null;

  // Before anything is put in front of the page: in probe mode, record what the
  // app actually drew. After mounting, the original content is covered.
  probeTick();

  // The class calendar's month view. It shares `page=CalendarPage` with the week,
  // and the app switches between the two without changing the page name, so the
  // grid itself is what identifies it.
  const month = readMonth(document);
  if (month) return mountMonth(month, onOriginal);

  // One decision, five cases (lib/route.js). The order is the contract: search
  // results are read live because the app draws their rows, a record page is
  // read with readForm and never through the chain, and the bare `admin.sd`
  // response is already in the browser so it is never fetched.
  switch (routeOf(location.href)) {
    case 'search':
      return mountSearchResults(onOriginal);
    case 'record':
      return mountRecord(onOriginal);
    case 'admin':
      return mountLive(onOriginal);
    default:
      break;
  }

  // Live first. The browser is already showing this page, so reading it costs
  // nothing and saves the GET this path used to pay on every single view — and
  // the model then describes the same tree the edits are written into.
  //
  // `fetch` and `app` both fall through to the fetched path below on purpose:
  // the fetched HTML can carry a view the live tree has not drawn yet, and
  // decideMount already owns the question of what to mount. Only `live` is
  // allowed to skip the GET, so the budget stays one GET per view at most.
  const liveModel = readPage(document, location.href);
  const source = chooseSource({
    liveView: liveModel && liveModel.view ? liveModel : null,
    liveHasShell: pageShape(document).shell,
    liveIsEmpty: liveIsBare(document)
  });
  if (source === 'live') return mountView(liveModel, onOriginal, 'live');

  let page;
  try {
    page = await fetchPage(location.href);
  } catch (err) {
    return mount({
      state: err instanceof SessionExpired ? 'expired' : 'error',
      message: err && err.message ? err.message : '',
      onOriginal
    });
  }

  // A page with no shell is a document of its own: a print window, a popup, the
  // outcome screen the app returns to. It is read by exactly the same chain as an
  // admin page — `model/root.js` says where its content is, the chain says what it
  // is — and the only thing that must not happen is covering it with "no view for
  // this page".
  //
  // This branch used to read a sheet specifically and mount only that, so a
  // shell-free list, report or notice was a coin flip. Now the shape asks the one
  // question it can answer (is there a shell?) and the chain answers the rest.
  const shape = pageShape(page.doc);
  if (shape.shellFree) {
    const shellFree = readPage(page.doc, page.finalUrl);
    const decision = decideShellLess({ view: shellFree.view, hasTitle: shape.titled });
    if (decision !== 'none') return mountView(shellFree, onOriginal);
    return mount({ state: 'none', onOriginal });
  }

  const model = readPage(page.doc, page.finalUrl);

  // Two rules about a page the server sent empty, both decided in choose.js so
  // that they can be tested: a note is only trusted when the live page agrees
  // with it, and a page with no view at all gets one more look if it carries a
  // form. The live read is skipped entirely when neither applies, so the 50 real
  // notices never pay for the check.
  const freshLook = wantsLiveLook({
    fetchedView: model.view,
    contradicts: model.view === 'note' && contradictsNote(document),
    hasForm: !!page.doc.querySelector('form')
  });

  if (freshLook) {
    const live = await readLiveView(document, location.href);
    const decision = decideMount({ fetchedView: model.view, liveView: live ? live.view : null });
    if (decision.source === 'live') return mountView(live, onOriginal, 'live');
    // Contradicted and unexplained: the server's sentence is not the screen the
    // browser is showing, and covering a real page with it would be a lie.
    if (decision.source === 'app') {
      recordView(null, 'app');
      console.info('[sd] note contradicted by the live page - leaving the app alone');
      return null;
    }
  }

  return mountView(model, onOriginal);
}

// Every handler the views need comes from the live page, never from the copy:
// the app is what builds each request.
function mountView(model, onOriginal, source = 'fetched') {
  // The app's own button bar lives outside the form, so it is read here, once,
  // for every page rather than inside each reader. The record screen is the one
  // that draws it — New and Delete come from there — and a page with no bar (the
  // add screen, which *is* the form) must not grow one.
  model = warnUnread(pageModel(model, document));
  // What this screen became, and where it came from. Only written when probe
  // mode is armed, so a production page pays nothing for it.
  recordView(model.view || null, source);
  return mount({
    model,
    state: model.view ? 'ready' : 'none',
    onOriginal,
    // A table you type into: the values the view holds are written into the
    // app's own fields and the app's own Save submits them. Nothing is built,
    // exactly as on a record.
    onSave: model.charges
      ? (values) => saveInApp(document, changesFrom(model.charges, values))
      : undefined,
    // New / Print / Email / Delete / More on a record page. Their ids exist on
    // the live page, which is where the app's own handlers are bound.
    onAction: (item) => clickActionInApp(document, item),
    // Running a report writes the changed filters into the live page and clicks
    // the app's own run control: the app builds the request, not this code.
    onRun: model.report
      ? (values) => runReportInApp(document, model.report, values)
      : null,
    // A settings/letter/mail form: our fields, the app's own button.
    onAct: model.task
      ? (values, action) => runTaskInApp(document, model.task, values, action)
      : null,
    // A table screen, a notice, or a confirmation the app is still waiting on:
    // its controls are pressed where they stand.
    onPress: model.sheet || model.note || model.charges || (model.confirm && model.confirm.pending)
      ? (action) => clickActionInApp(document, action)
      : null,
    // Attendance: every gesture is written into the app's own controls — a tick
    // pressed so its own onChange runs, a reason and notes written where the app
    // keeps them, and the page's own Save. Nothing here builds a request.
    onAttend: model.attendance
      ? {
        mark: (boxId, present) => markAttendanceInApp(document, boxId, present),
        absence: (cell, reason, notes) => writeAbsenceInApp(document, cell, reason, notes),
        notes: (field, value) => writeNotesInApp(document, field, value),
        press: (action) => clickActionInApp(document, action),
        save: () => pressAttendanceSave(document)
      }
      : null,
    // A toggle screen: our controls, the app's own Save.
    onSaveSettings: model.settings
      ? (values, action) => saveSettingsInApp(document, model.settings, values, action)
      : null,
    // New Payment: our fields, the app's own Process Payment and Add Split.
    onSubmitPayment: model.payment
      ? (values) => runPayment(document, model.payment, values)
      : null,
    onAddSplit: model.payment
      // The URL comes along so the re-read names the screen the same way the
      // first read did, instead of falling back to the buttons' words.
      ? () => addSplitInApp(document, model.payment, model.url || location.href)
      : null,
    onLoadAll: loadAllRecords,
    onSearch: searchEverything,
    onRefresh: refreshList,
    period: readPeriodControl(document),
    onPeriod: (value) => choosePeriodInApp(document, value),
    // The calendar's own Prev / Next / view links, read where they stand.
    nav: readCalendarNav(document),
    canLoadAll: !!showAllTrigger(document)
  });
}

// The two things a page carries that the readers do not: the app's own button
// bar, and — on the screen a save lands on — the list that answer belongs beside.
//
// Both are read from the live document, because that is where the controls get
// clicked and where the browser is already showing the list. Nothing is fetched.
function pageModel(model, doc) {
  const bar = readBar(doc);
  const next = { ...model, bar: model.bar !== undefined ? model.bar : bar };

  // A delete answer names nothing: the app prints " has been deleted." because
  // the record — and the link that carried its name — is gone. Put back the name
  // it asked about, so the sentence says what happened to what.
  if (next.confirm) next.confirm = confirmSubject(next.confirm, next.url || location.href);

  // A save answers with a sentence and the list you carried on from. Read that
  // list too, so the sentence sits above the table instead of replacing it —
  // which is what the app's own page does. A refusal has no list to return to.
  // The app's delete question carries the same list: it is drawn as a dialog over
  // that table rather than as its own screen.
  const asked = !!(next.confirm && next.confirm.ask);
  if (next.confirm && next.confirm.ok && (!next.confirm.pending || asked)) {
    const sheet = readSheet(doc);
    if (sheet && sheet.tables && sheet.tables.length) next.records = sheet;
  }

  return next;
}

// A screen that drew fewer controls than the page has says so, once, in the
// console — the diagnostic half of `model/coverage.js`. It is not chrome: the one
// page that reports anything today is Edit Family, whose three phone-type selects
// sit in the row's *label* cell and are not offered yet, and a rebuild that says
// nothing about that is the bug this exists to stop. A warning nobody looks at is
// not a check, so it names the controls rather than counting them.
function warnUnread(model) {
  const list = unreadOf(model);
  if (!list.length) return model;
  console.info('[sd] ' + unreadNote(model) + ':', list);
  return model;
}

// The month grid: the same rail and season picker as the week, drawn as a
// calendar. Every link it shows — another month, another season, the week view,
// a day — is the app's own, so none of them is built here.
function mountMonth(month, onOriginal) {
  recordView('month', 'live');
  return mount({
    model: {
      nav: railLinks(document),
      month,
      view: 'month',
      list: null,
      title: month.title,
      breadcrumb: month.breadcrumb,
      url: location.href
    },
    state: 'ready',
    onOriginal,
    onPress: (action) => clickActionInApp(document, action),
    onSearch: searchEverything,
    period: readPeriodControl(document),
    onPeriod: (value) => choosePeriodInApp(document, value)
  });
}

// "Show All" in the app's own panel, then a re-read of the live page. Nothing
// here builds a URL: the app's control is what knows how to fetch the rest, and
// pressing it is what a person would do anyway.
// Global search: the app's own box does the work, then its results page comes
// back through the normal mount path (a list, with the same panel shape).
export function searchEverything(query) {
  return runSearch(document, query);
}

// The same panel, read again where it stands. The app fills its record panel by
// script, so the first reading is one window of it; this is how the list follows
// the fill to the end instead of sitting on the first 500 rows.
export function refreshList(doc = document) {
  return readList(doc, { allowEmpty: true });
}

export async function loadAllRecords(doc = document) {
  const res = await expandInApp(doc);
  if (!res.clicked) return { list: null, reason: 'no-trigger' };
  const list = readList(doc);
  if (!list) return { list: null, reason: 'no-list' };
  return {
    list,
    count: res.count,
    changed: res.changed,
    // What the attempt actually did, so a control that does nothing reports
    // evidence rather than silence.
    tried: res.tried || [],
    requests: res.requests || []
  };
}

// Search results. The URL alone is not enough: the panel is filled by the app's
// own JS after load (the page carries DWR iframes, not rows), so this page is
// read live and only once its rows are there. The wait itself is `lib/live.js`,
// with the clock injectable, because a timer is the one thing a fixture cannot
// reach; the longer budget is this screen's own.
async function mountSearchResults(onOriginal) {
  // Waiting for "a list" is not enough: the page arrives still carrying the
  // record panel of the page the search started from, and that panel reads as a
  // list. Wait for the app's own results title instead, then mount that.
  // The title arrives before the rows: the app writes "Search Results for …",
  // then replaces the record panel it was already showing. Reading on the title
  // alone mounted the previous page's list under the new heading, so the wait is
  // for the panel itself — its own total reached, or a different total than the
  // one first seen.
  //
  // The question is asked of a cheap look at the panel — its title, its heading,
  // its stated total and its first row — not of a whole read. A full read walks
  // every result row, and a live search has thousands: asking that every 120ms
  // starved the page it was waiting for, so the skin could appear ten seconds
  // late, or the mount could die on a read taken mid-rewrite and leave the app's
  // own page showing.
  const first = panelPeek(document);
  const started = Date.now();
  while (Date.now() - started < 8000) {
    let now = null;
    try {
      now = panelPeek(document);
    } catch (err) {
      now = null; // a look taken mid-rewrite is not an answer to anything
    }
    // `searchReadyOrLate`, not `searchReady`: the results page is often served
    // already holding the results, so a wait for a *change* never ended and the
    // page stayed unskinned for the whole budget.
    if (now && searchReadyOrLate(now, first, Date.now() - started)) break;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  // One full read, now that the panel says what it is. A read that still fails is
  // retried and then reported, rather than thrown into the mount: an exception
  // here used to take the whole mount with it, and the boot's own catch turns
  // that into the app's page with no skin and no explanation.
  let model = null;
  for (let attempt = 0; attempt < 5 && !model; attempt += 1) {
    try {
      model = readPage(document, location.href, { allowEmpty: true });
    } catch (err) {
      console.info('[sd] search results read failed - trying again:', err && err.message ? err.message : err);
      const pause = 120 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
  }
  if (!model) {
    console.info('[sd] search results could not be read - leaving the app alone');
    return null;
  }
  return mountView(model, onOriginal, 'live');
}

// The page the browser is already showing, read where it stands. Used for the
// bare `admin.sd` URL, which is what the app returns after a save (and after a
// refused save): the message and the record list are in that response.
function mountLive(onOriginal) {
  // A record page reached without a page name (the URL the app leaves behind
  // after a refused save) is still an editor, and must not be read as a week or
  // a list just because the URL lost its `page=Edit…`.
  const record = readRecordPage(document, location.href);
  if (record && record.view === 'form') {
    return mountEditor(record.model, onOriginal);
  }

  const model = readPage(document, location.href, { allowRefused: true });
  if (!model.view) {
    console.info('[sd] no rebuilt view for this page - leaving the app alone');
    return null;
  }

  return mountView(model, onOriginal);
}

// The performance list's own save.
//
// The new arrangement goes into the app's own hidden order inputs - only the rows
// that moved - and then the app's Save is pressed. Nothing is built here: the app
// serialises its form, validates and redirects exactly as it does for a click, and
// a row whose input has gone refuses the save rather than writing half an order.
function savePerfOrder(doc, rows) {
  const ordered = applyOrder(doc, rows);
  if (ordered.missing.length) {
    return { submitted: false, reason: 'order-missing', missing: ordered.missing };
  }
  if (!ordered.applied.length) return { submitted: false, reason: 'unchanged' };
  const save = pageSave(doc);
  if (!save) return { submitted: false, reason: 'no-save-link' };
  save.click();
  return { submitted: true, reason: 'ok', applied: ordered.applied };
}

// The editor's mount: the one view that saves. Every other kind goes through
// mountView, which is why this is separate rather than a branch inside it.
function mountEditor(model, onOriginal) {
  warnUnread(model);
  recordView('form', 'live');
  return mount({
    model,
    state: 'ready',
    onSave: (values) => saveInApp(document, changesFrom(model.form, values)),
    onAction: (item) => clickActionInApp(document, item),
    onPerfAct: (item) => clickActionInApp(document, item),
    onPerfLock: (row) => pressLock(document, row),
    onPerfSave: (rows) => savePerfOrder(document, rows),
    onLoadAll: loadAllRecords,
    onSearch: searchEverything,
    onRefresh: refreshList,
    canLoadAll: !!showAllTrigger(document),
    onOriginal
  });
}

// A record page: the editor is rebuilt only when the page really has a form of
// the dumped shape. Anything else is left to the app, untouched — no overlay —
// because covering a form is how you end up unable to edit.
//
// Which screen the page is, in what order, is `lib/record.js`; this function is
// the fetching and the mounting.
function mountRecord(onOriginal) {
  // The app answers a delete on the record's own URL (`meth=delconfirmed`), so
  // routing sends that page here — but it is not an editor. It is the same shape
  // a save returns: a sentence and the list you carried on from. Read it through
  // the chain in that one case, so the sentence lands above the table instead of
  // the page drawing as a bare list with its confirmation dropped.
  const answered = readPage(document, location.href, { allowRefused: true });
  if (answered.view === 'confirm') return mountView(answered, onOriginal);

  // New Payment arrives on a URL that looks like a record's (`&meth=…&tid=…`),
  // so routing brings it here — but it is not an editor, and the gateway URL
  // answers a re-fetch with a different page. Its screen is the one the browser
  // is already showing, so it is read where it stands.
  if (answered.view === 'payment') return mountView(answered, onOriginal, 'live');

  // Live first, copy second. The form is server-rendered, but the app's JS fills
  // part of it after the response lands (the phone-label selects start empty),
  // and an empty select is skipped as uneditable: the fetched copy of EditFamily
  // came back with 19 fields where the page has 22. Reading where it stands is
  // also the tree the edits get written into.
  const live = hasForm(document);
  const source = live
    ? Promise.resolve({ doc: document, finalUrl: location.href })
    : fetchPage(location.href);

  return source
    .then((page) => {
      const found = readRecordPage(page.doc, page.finalUrl);

      if (!found) {
        console.info('[sd] record page - leaving the app\u2019s editor alone');
        return null;
      }

      if (found.view === 'form') {
        // Probe mode records where every other view came from; records were the
        // one kind with no verdict in the log, which is exactly the kind the plan
        // is trying to check. Read where it stands, the form's source is `live`
        // even when the page was fetched as a fallback.
        recordView('form', live ? 'live' : 'fetched');
        return mountEditor(found.model, onOriginal);
      }

      return mountView(found.model, onOriginal);
    })
    .catch((err) => {
      // A failed read is not worth replacing a working page with an error.
      console.info('[sd] record page - left alone:', err && err.message ? err.message : err);
      return null;
    });
}
