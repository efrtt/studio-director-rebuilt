import App from './App.svelte';
import { injectStyles, removeStyles } from './lib/styles.js';
import {
  fetchPage, hasShell, liveIsBare, parseHtml, SessionExpired
} from './lib/shell.js';
import { routeOf } from './lib/route.js';
import { readList } from './lib/list.js';
import { expandInApp, showAllTrigger } from './lib/expand.js';
import { runSearch } from './lib/search.js';
import { readPeriodControl, choosePeriodInApp } from './lib/period.js';
import { readNavIcons } from './lib/navicons.js';
import { backTarget } from './lib/backlink.js';

// Replaced at build time by vite.config.js.
const VERSION = typeof __SD_VERSION__ !== 'undefined' ? __SD_VERSION__ : 'dev';
import { readPage } from './lib/page.js';
import { hasForm } from './lib/form.js';
import { runReportInApp } from './lib/report.js';
import { runTaskInApp } from './lib/task.js';
import { readSheet } from './lib/sheet.js';
import { saveSettingsInApp } from './lib/settings.js';
import { clickActionInApp } from './lib/actions.js';
import { changesFrom, saveInApp } from './lib/save.js';
import { probeTick, recordView } from './lib/probe.js';
import { contradictsNote } from './lib/note.js';
import { wantsLiveLook, decideMount, decideShellLess, chooseSource, looksLikeSearchResults, searchSettled } from './lib/choose.js';
import { readRecordPage } from './lib/record.js';
import { readLiveView } from './lib/live.js';

export { readPage };
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

  injectStyles();
  document.documentElement.classList.add('sd-app');

  const root = document.createElement('div');
  root.id = 'sd-root';
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
      // Same for reports: their run control is on the live page.
      onRun: opts.onRun || null,
      // Toggle screens: our controls, the app's own Save.
      onSaveSettings: opts.onSaveSettings || null,
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
    liveHasShell: hasShell(document),
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

  // A print window has no shell at all: `PrintClassRoster` is a title, one
  // table and the browser's own extension roots, with no rail and no top bar
  // (confirmed by a dump of the real page). That is still a screen worth
  // reading, and the only thing that must not happen is covering it with "no
  // view for this page".
  if (!hasShell(page.doc)) {
    const print = readSheet(page.doc);
    // The rule is in choose.js, where it has a test: a print window is a screen
    // only when a reader claims it and the page names itself.
    const bare = decideShellLess({
      hasSheet: !!print,
      hasTitle: !!page.doc.querySelector('.formTitle, .ReportName')
    });
    if (bare === 'sheet') {
      return mountView({ nav: [], sheet: print, view: 'sheet', title: print.title, url: page.finalUrl }, onOriginal);
    }
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
  // What this screen became, and where it came from. Only written when probe
  // mode is armed, so a production page pays nothing for it.
  recordView(model.view || null, source);
  return mount({
    model,
    state: model.view ? 'ready' : 'none',
    onOriginal,
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
    onPress: model.sheet || model.note || (model.confirm && model.confirm.pending)
      ? (action) => clickActionInApp(document, action)
      : null,
    // A toggle screen: our controls, the app's own Save.
    onSaveSettings: model.settings
      ? (values, action) => saveSettingsInApp(document, model.settings, values, action)
      : null,
    onLoadAll: loadAllRecords,
    onSearch: searchEverything,
    onRefresh: refreshList,
    period: readPeriodControl(document),
    onPeriod: (value) => choosePeriodInApp(document, value),
    canLoadAll: !!showAllTrigger(document)
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
  const first = readPage(document, location.href, { allowEmpty: true });
  let model = first;
  const started = Date.now();
  while (Date.now() - started < 8000) {
    if (searchSettled(model, first)) break;
    await new Promise((resolve) => setTimeout(resolve, 120));
    model = readPage(document, location.href, { allowEmpty: true });
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

// The editor's mount: the one view that saves. Every other kind goes through
// mountView, which is why this is separate rather than a branch inside it.
function mountEditor(model, onOriginal) {
  recordView('form', 'live');
  return mount({
    model,
    state: 'ready',
    onSave: (values) => saveInApp(document, changesFrom(model.form, values)),
    onAction: (item) => clickActionInApp(document, item),
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
