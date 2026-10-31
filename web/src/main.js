import App from './App.svelte';
import { injectStyles, removeStyles } from './lib/styles.js';
import {
  fetchPage, hasShell, railLinks, parseHtml, SessionExpired
} from './lib/shell.js';
import { routeOf } from './lib/route.js';
import { readList } from './lib/list.js';
import { expandInApp, showAllTrigger } from './lib/expand.js';
import { runSearch } from './lib/search.js';
import { readPage } from './lib/page.js';
import { readForm } from './lib/form.js';
import { readBar } from './lib/bar.js';
import { readTabs } from './lib/tabs.js';
import { runReportInApp } from './lib/report.js';
import { readTask, runTaskInApp } from './lib/task.js';
import { readSheet } from './lib/sheet.js';
import { readSettings, saveSettingsInApp } from './lib/settings.js';
import { clickActionInApp } from './lib/actions.js';
import { changesFrom, saveInApp } from './lib/save.js';
import { probeTick, recordView } from './lib/probe.js';
import { contradictsNote } from './lib/note.js';
import { wantsLiveLook, decideMount, decideShellLess, hasReadyView } from './lib/choose.js';

export { readPage };
// Probe mode's two ends: `SD.probeDump()` returns every screen measured so far,
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
    const live = await readLiveView();
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
    // A table screen or a notice: its controls are pressed where they stand.
    onPress: model.sheet || model.note
      ? (action) => clickActionInApp(document, action)
      : null,
    // A toggle screen: our controls, the app's own Save.
    onSaveSettings: model.settings
      ? (values, action) => saveSettingsInApp(document, model.settings, values, action)
      : null,
    onLoadAll: loadAllRecords,
    onSearch: searchEverything,
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
// read live and only once its rows are there.
async function mountSearchResults(onOriginal) {
  const rows = () => document.querySelectorAll('#idSearchSpan .searchResultItem').length;
  const started = Date.now();
  while (!rows() && Date.now() - started < 4000) {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const model = readPage(document, location.href, { allowEmpty: true });
  return mountView(model, onOriginal);
}

// The page the browser is already showing, read where it stands. Used for the
// bare `admin.sd` URL, which is what the app returns after a save (and after a
// refused save): the message and the record list are in that response.
function mountLive(onOriginal) {
  // A record page reached without a page name (the URL the app leaves behind
  // after a refused save) is still an editor, and must not be read as a week or
  // a list just because the URL lost its `page=Edit…`.
  const record = recordModel(document, location.href);
  if (record) {
    return mount({
      model: record,
      state: 'ready',
      onSave: (values) => saveInApp(document, changesFrom(record.form, values)),
      onAction: (item) => clickActionInApp(document, item),
      onLoadAll: loadAllRecords,
      onSearch: searchEverything,
      canLoadAll: !!showAllTrigger(document),
      onOriginal
    });
  }

  const model = readPage(document, location.href, { allowRefused: true });
  if (!model.view) {
    console.info('[sd] no rebuilt view for this page - leaving the app alone');
    return null;
  }

  return mountView(model, onOriginal);
}

// A record page: the editor is rebuilt only when the page really has a form of
// the dumped shape. Anything else is left to the app, untouched — no overlay —
// because covering a form is how you end up unable to edit.
//
// readForm, never readPage: the class editor contains a Calendar tab with seven
// TimeBlock tables, and the week adapter would read that tab as the calendar.
function mountRecord(onOriginal) {
  return fetchPage(location.href)
    .then((page) => {
      const nav = railLinks(page.doc);
      const list = readList(page.doc);
      const form = readForm(page.doc);
      const editor = recordModel(page.doc, page.finalUrl);

      if (editor) {
        // Edit pages opened from a list carry that list in the side panel
        // (`#idSearchSpan`, plus `#searchidx`). Showing it keeps record-to-record
        // navigation inside the app instead of a trip back to Classes.
        return mount({
          model: editor,
          state: 'ready',
          onSave: (values) => saveInApp(document, changesFrom(editor.form, values)),
          onAction: (item) => clickActionInApp(document, item),
          onLoadAll: loadAllRecords,
          onSearch: searchEverything,
          canLoadAll: !!showAllTrigger(document),
          onOriginal
        });
      }

      // A form without a save control is not an editor: `PrintClassRoster` and
      // `Attendance` carry forty and a hundred controls, and an editor built
      // from them would be a dead wall of inputs. Their own controls do the
      // work, so they are read as a task, or as a table when that is all they
      // have.
      const task = form ? readTask(page.doc) : null;
      if (task) {
        return mountView({ nav, list, url: page.finalUrl, task, view: 'task', title: task.title }, onOriginal);
      }

      const sheet = readSheet(page.doc);
      if (sheet) {
        return mountView({ nav, list, url: page.finalUrl, sheet, view: 'sheet', title: sheet.title }, onOriginal);
      }

      const settings = readSettings(page.doc);
      if (settings) {
        return mountView({ nav, list, url: page.finalUrl, settings, view: 'settings', title: settings.title }, onOriginal);
      }

      // Not an editor, a form, a table or a toggle — but a page can carry a
      // record parameter and still be something else entirely. `Enroll(sident)`
      // and `SwitchClasses` are the week calendar, `EnrollmentSearch` is a
      // record list, `EmailTextHome(meth)` is a menu. Those are real screens, so
      // the page router gets the last word before the app does.
      const other = readPage(page.doc, page.finalUrl);
      if (other.view) {
        return mountView({ ...other, list: other.list || list }, onOriginal);
      }

      console.info('[sd] record page - leaving the app\u2019s editor alone');
      return null;
    })
    .catch((err) => {
      // A failed read is not worth replacing a working page with an error.
      console.info('[sd] record page - left alone:', err && err.message ? err.message : err);
      return null;
    });
}

// The live page's model, once the app has drawn whatever it was going to draw.
// `SearchResults` and the Enroll step proved the pattern: for a JS-built screen
// the fetched HTML is an empty shell, and only the live DOM has the controls.
// Reading it immediately would catch the page mid-render, hence the short wait.
async function readLiveView(maxWait = 1500) {
  const first = readPage(document, location.href);
  if (hasReadyView(first)) return first;

  const started = Date.now();
  while (Date.now() - started < maxWait) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const next = readPage(document, location.href);
    if (hasReadyView(next)) return next;
  }
  return null;
}

// The record editor's model, or null when the page is not one.
//
// A record editor is a form *plus a way to save it*. The app puts Save in the
// top bar, so `#save` is the check; the tabbed record pages are editors even
// when that id differs, because they are the only record screens with tabs.
function recordModel(doc, url) {
  const form = readForm(doc);
  if (!form) return null;

  const tabs = readTabs(doc);
  const tabbed = !!(tabs && tabs.tabs.length > 1);
  if (!doc.getElementById('save') && !tabbed) return null;

  return {
    nav: railLinks(doc),
    form,
    // The bar above the tabs: New, Print, Email, Delete, Edit Family, More.
    bar: readBar(doc),
    // Enrollment, Skills, Calendar: the page already carries them hidden, so
    // they are rebuilt from the same response as the form.
    tabs,
    list: readList(doc),
    view: 'form',
    title: form.title,
    url
  };
}
