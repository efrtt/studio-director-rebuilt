// The in-page half of the two-build parity check.
//
// `tools/parity.mjs` snapshots two builds of the userscript and serves them from
// the loopback server. This probe is injected into a signed-in app tab, loads
// one of those builds, and records what the rebuild actually rendered: the view
// the reader chose, its rows, labels, control types and a digest of the values.
// Two builds, one page, same reading — that is parity.
//
// It is deliberately a plain script with no imports: it has to run in the app's
// own page (not a module context) from the devtools console or one automation
// `evaluate`, and it must leave nothing behind but a `window.sdParity` helper and
// a POSTed dump on disk.
//
// Usage on a live page, once per build (reload between builds; the overlay is not
// torn down):
//
//   const s = document.createElement('script');
//   s.src = 'http://127.0.0.1:4801/web/tools/parity-probe.js?t=' + Date.now();
//   document.head.appendChild(s);
//   await new Promise((r) => { s.onload = r; });
//   await sdParity.run('http://127.0.0.1:4801/web/parity/current.user.js', 'current');
//
// `run` waits for `#sd-root`, collects, and POSTs the dump to the dev server at
// `/__parity/<label>`, which writes `web/parity/<label>.json`. Then:
//
//   node web/tools/parity.mjs compare web/parity/current.json web/parity/main.json
//
// Privacy: labels and headings are the app's own field names and are kept;
// values and cell text are hashed, never stored as text. Nothing is compared by
// version — the two builds deliberately have different numbers.

(function () {
  'use strict';

  var KEY = 'sdParity.dumps';
  var POST_TO = 'http://127.0.0.1:4801/__parity/';
  // Long enough for the heaviest screen to finish drawing: the search-results
  // page expands its record panel to 8,000+ rows after load, and the build does
  // not mount until the page it reads has settled. 9 s was short enough there
  // that a plain `run` recorded `mounted: false`, which is an empty capture, not
  // a disagreement — so the wait is long enough for that page and every light
  // one still mounts in well under a second.
  var WAIT_MS = 20000;

  function text(el) {
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  // FNV-1a: a stable fingerprint for text that may be personal. Collisions are
  // not a concern for a comparison of the same screen against itself.
  function hash(value) {
    var s = String(value == null ? '' : value);
    var h = 2166136261;
    for (var i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function texts(root, selector) {
    return Array.prototype.map.call(root ? root.querySelectorAll(selector) : [], text);
  }

  function count(root, selector) {
    return root ? root.querySelectorAll(selector).length : 0;
  }

  // The build installs `refreshDecision` on `sdProbe`; arm that namespace so it
  // does, and ask for a stamp against the page as it is now, not as it was
  // mid-load.
  window.sdProbe = window.sdProbe || {};

  function parseJson(text) {
    try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
  }

  function digest(value) {
    return hash(JSON.stringify(value));
  }

  function controlOf(el) {
    var tag = el.tagName.toLowerCase();
    var type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
    var value;
    if (type === 'checkbox') value = String(!!el.checked);
    else if (type === 'radio') value = String(!!el.checked) + ':' + hash(el.value);
    else value = hash(el.value);
    return { t: type, n: hash(el.getAttribute('name') || ''), v: value };
  }

  function controls(root, selector) {
    return Array.prototype.map.call(root ? root.querySelectorAll(selector) : [], controlOf);
  }

  function editorView(root) {
    var controlsIn = root.querySelectorAll('.sd-fields td input, .sd-fields td select, .sd-fields td textarea');
    return {
      rows: count(root, '.sd-fields tr'),
      labels: texts(root, '.sd-fields th[scope="row"]'),
      controls: Array.prototype.map.call(controlsIn, controlOf)
    };
  }

  function settingsView(root) {
    return {
      count: count(root, '.sd-setting'),
      labels: texts(root, '.sd-settingtext'),
      controls: count(root, '.sd-settingcontrol input, .sd-settingcontrol select, .sd-settingcontrol textarea')
    };
  }

  function reportView(root) {
    return {
      filters: count(root, '.sd-filterrow'),
      labels: texts(root, '.sd-filterlabel'),
      controls: count(root, '.sd-filterfield input, .sd-filterfield select, .sd-filterfield textarea'),
      trigger: text(root.querySelector('.sd-editor-actions .sd-primary'))
    };
  }

  // One sheet table's reading. Shared by the single-shot view and the chunked
  // collection, so a chunked dump is identical to the one `run` would produce.
  function tableDigest(table) {
    var rows = table.querySelectorAll('tbody tr');
    return {
      headings: texts(table, 'thead th'),
      rows: rows.length,
      digest: digest(Array.prototype.map.call(rows, function (tr) {
        return Array.prototype.map.call(tr.children, function (cell) { return hash(text(cell)); });
      }))
    };
  }

  function sheetView(root) {
    var tables = Array.prototype.map.call(root.querySelectorAll('.sd-sheetbody .sd-table'), tableDigest);
    return {
      tables: tables.length,
      rows: tables.reduce(function (n, t) { return n + t.rows; }, 0),
      digest: digest(tables),
      first: tables[0] || null
    };
  }

  function indexView(root) {
    return {
      groups: texts(root, '.sd-indexhead'),
      links: count(root, '.sd-index a[href]'),
      cards: count(root, '.sd-card')
    };
  }

  function recordView(root) {
    return {
      cards: count(root, '.sd-recordcard'),
      count: text(root.querySelector('.sd-recordcount')),
      tabs: texts(root, '.sd-tabs .sd-tab')
    };
  }

  function noteView(root) {
    return {
      title: text(root.querySelector('.sd-eyebrow, .sd-dialog-title, h2')),
      buttons: texts(root, '.sd-editor-actions .sd-btn, .sd-dialog-actions .sd-btn'),
      links: count(root, '.sd-note a[href]')
    };
  }

  function listView(root) {
    return {
      rows: count(root, '.sd-records li, .sd-records tr'),
      count: text(root.querySelector('.sd-recordcount, .sd-count')),
      filters: count(root, '.sd-filter'),
      columns: texts(root, '.sd-records thead th'),
      letters: count(root, '.sd-letters a[href]')
    };
  }

  function weekView(root) {
    return {
      columns: count(root, '.sd-studiocol'),
      blocks: count(root, '.sd-block'),
      names: texts(root, '.sd-block-name'),
      rows: count(root, '.sd-weekrow'),
      rowTimes: texts(root, '.sd-weekrow-time'),
      days: texts(root, '.sd-dayname'),
      range: text(root.querySelector('.sd-monthlabel')),
      totals: text(root.querySelector('.sd-weekbar .sd-count'))
    };
  }

  function monthView(root) {
    return {
      label: text(root.querySelector('.sd-monthlabel')),
      weekdays: texts(root, '.sd-monthweekday'),
      weeks: count(root, '.sd-monthweek'),
      days: count(root, '.sd-day'),
      events: count(root, '.sd-event'),
      holidays: count(root, '.sd-holiday'),
      eventNames: texts(root, '.sd-eventname')
    };
  }

  // The register: one column per date, one row per student, and every cell a
  // tick. The names and the counts are the page's own; only the shape is read.
  function attendanceView(root) {
    return {
      cols: count(root, '.sd-attcol'),
      dates: texts(root, '.sd-attcolhead'),
      rows: count(root, '.sd-attrow'),
      // Names are the app's people, not its labels: hashed, like every value.
      names: texts(root, '.sd-attname').map(hash),
      ticks: count(root, '.sd-attcol input[type="checkbox"]'),
      marks: count(root, '.sd-attmark'),
      counts: texts(root, '.sd-attcount'),
      notes: count(root, '.sd-attnotes textarea, .sd-attnotes input')
    };
  }

  // The dashboard: eight stat cells and the donut's parts, in the page's order.
  function insightsView(root) {
    return {
      stats: count(root, '.sd-stat'),
      values: texts(root, '.sd-statvalue'),
      labels: texts(root, '.sd-statlbl'),
      donut: !!root.querySelector('.sd-donut'),
      total: text(root.querySelector('.sd-donuthole strong')),
      parts: count(root, '.sd-donutlegend li'),
      legend: texts(root, '.sd-donutlegend li'),
      tabs: texts(root, '.sd-tabs .sd-tab')
    };
  }

  // The trends tab: the app's own chart images under the columns it prints them
  // in, then the tables the page carries.
  function trendsView(root) {
    return {
      charts: count(root, '.sd-chart'),
      titles: texts(root, '.sd-charttitle'),
      // A caption is the chart's own reading, not a label: it carries hours and
      // money ("This month: $…"), so it is hashed like every other value.
      captions: texts(root, '.sd-chartcap').map(hash),
      images: count(root, '.sd-chart img'),
      sections: texts(root, '.sd-sheethead'),
      tables: count(root, '.sd-table'),
      headings: texts(root, '.sd-table thead th'),
      rows: count(root, '.sd-table tbody tr'),
      links: count(root, '.sd-sheetlinks a')
    };
  }

  function confirmView(root) {
    return {
      title: text(root.querySelector('.sd-confirm-mark, .sd-eyebrow')),
      message: hash(text(root.querySelector('.sd-confirm-msg'))),
      buttons: texts(root, '.sd-confirm-actions .sd-btn'),
      mount: 'confirm'
    };
  }

  // Which content root the page itself has, and whether it carries content. A
  // page with no mount is undetected; a page with a mount and no rows is a real
  // screen that legitimately has none — the two must never look alike.
  function appOf() {
    var root = document.querySelector('#mainContent') || document.querySelector('.contentContainer') || document.body;
    var ours = document.querySelector('#sd-root');
    var tables = 0;
    var rows = 0;
    if (root) {
      var list = root.querySelectorAll('table');
      for (var i = 0; i < list.length; i += 1) {
        if (ours && ours.contains(list[i])) continue;
        tables += 1;
        rows += list[i].querySelectorAll('tr').length;
      }
    }
    return {
      root: root && (root.id ? '#' + root.id : root.className ? '.' + String(root.className).split(/\s+/)[0] : root.tagName.toLowerCase()),
      text: root ? text(root).length > 0 : false,
      tables: tables,
      rows: rows
    };
  }

  // The register keeps `.sd-fields` inside its absence dialog, so the view's own
  // root has to be asked before the editor's.
  function kindOf(root) {
    if (!root) return 'none';
    if (root.querySelector('.sd-att')) return 'attendance';
    if (root.querySelector('.sd-insights')) return 'insights';
    if (root.querySelector('.sd-trends')) return 'trends';
    if (root.querySelector('.sd-settings')) return 'settings';
    if (root.querySelector('.sd-report')) return 'report';
    if (root.querySelector('.sd-fields')) return 'editor';
    if (root.querySelector('.sd-sheet')) return 'sheet';
    if (root.querySelector('.sd-index')) return 'index';
    if (root.querySelector('.sd-month')) return 'month';
    if (root.querySelector('.sd-week')) return 'week';
    if (root.querySelector('.sd-recordpage')) return 'record';
    if (root.querySelector('.sd-list')) return 'list';
    if (root.querySelector('.sd-confirm')) return 'confirm';
    return 'other';
  }

  function viewOf(root) {
    var kind = kindOf(root);
    if (kind === 'none') return { kind: 'none', detected: false, app: appOf() };
    var body;
    switch (kind) {
      case 'settings': body = { settings: settingsView(root) }; break;
      case 'report': body = { report: reportView(root) }; break;
      case 'editor': body = { editor: editorView(root) }; break;
      case 'sheet': body = { sheet: sheetView(root) }; break;
      case 'index': body = { index: indexView(root) }; break;
      case 'month': body = { month: monthView(root) }; break;
      case 'week': body = { week: weekView(root) }; break;
      case 'record': body = { record: recordView(root) }; break;
      case 'list': body = { list: listView(root) }; break;
      case 'confirm': body = { confirm: confirmView(root) }; break;
      case 'attendance': body = { attendance: attendanceView(root) }; break;
      case 'insights': body = { insights: insightsView(root) }; break;
      case 'trends': body = { trends: trendsView(root) }; break;
      default: body = { note: noteView(root) };
    }
    body.kind = kind;
    body.detected = kind !== 'other';
    body.app = appOf();
    return body;
  }

  // Everything a dump carries except the view, so the single-shot and chunked
  // paths cannot drift apart in what they record.
  function baseOut(label) {
    var root = document.querySelector('#sd-root');
    return {
      label: String(label || 'dump'),
      at: new Date().toISOString(),
      url: location.pathname + location.search,
      mounted: !!root,
      theme: document.documentElement.getAttribute('data-sd-theme') || '',
      foot: text(document.querySelector('.sd-foot')),
      tabs: texts(root, '.sd-tabs .sd-tab'),
      // Which decision produced this page: path, content root, and the table and
      // row counts it used. Stamped on `#sd-root` by the build itself, so a dump
      // cannot show "equal to main" while a fallback did the work unseen.
      decision: root ? {
        path: root.getAttribute('data-sd-path') || '',
        root: root.getAttribute('data-sd-root') || '',
        source: root.getAttribute('data-sd-source') || '',
        controls: Number(root.getAttribute('data-sd-controls') || 0),
        links: Number(root.getAttribute('data-sd-links') || 0),
        tables: parseJson(root.getAttribute('data-sd-tables')),
        rows: parseJson(root.getAttribute('data-sd-rows')),
        fallback: root.getAttribute('data-sd-fallback') || ''
      } : null,
      // The record page can sit beside an editor, a task or an outcome screen;
      // it is a panel, not a view, so it is read wherever it appears.
      panel: root && root.querySelector('.sd-recordpage') ? recordView(root) : null
    };
  }

  function collect(label) {
    if (window.sdProbe && typeof window.sdProbe.refreshDecision === 'function') {
      window.sdProbe.refreshDecision();
    }
    var out = baseOut(label);
    out.view = viewOf(document.querySelector('#sd-root'));
    out.detected = !!out.mounted && !!out.view.detected;
    out.digest = digest({
      url: out.url, mounted: out.mounted, tabs: out.tabs, view: out.view, panel: out.panel, decision: out.decision
    });
    var store = readStore();
    store[out.label] = out;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private mode */ }
    return out;
  }

  // ---- chunked collection ----
  //
  // A 187-table report is too much to read inside one automation `evaluate`
  // (about 10 s). The expensive part is per-table: hashing every cell of every
  // table. `begin` snapshots the page once, `step` reads as many tables as fit
  // in a time budget, and `finish` assembles the same dump `collect` would have
  // written. Each call is safely under the limit, and the result is byte-for-byte
  // the shape `run` produces.
  var job = null;

  function begin(label) {
    if (window.sdProbe && typeof window.sdProbe.refreshDecision === 'function') {
      window.sdProbe.refreshDecision();
    }
    var root = document.querySelector('#sd-root');
    var kind = kindOf(root);
    job = {
      out: baseOut(label),
      kind: kind,
      view: null,
      pending: [],
      tables: [],
      index: 0,
      total: 0,
      app: null
    };
    if (kind === 'sheet') {
      job.app = appOf();
      job.pending = Array.prototype.slice.call(root.querySelectorAll('.sd-sheetbody .sd-table'));
      job.total = job.pending.length;
      job.view = { sheet: null, kind: 'sheet', detected: true, app: job.app };
    } else {
      job.view = viewOf(root);
    }
    return { kind: kind, index: 0, total: job.total, done: job.total === 0 };
  }

  function step(budgetMs) {
    if (!job) throw new Error('no collection in progress; call begin first');
    var budget = Number(budgetMs) || 4000;
    var started = Date.now();
    if (job.kind === 'sheet') {
      while (job.index < job.total) {
        job.tables.push(tableDigest(job.pending[job.index]));
        job.index += 1;
        if (Date.now() - started >= budget) break;
      }
    }
    return { kind: job.kind, index: job.index, total: job.total, done: job.index >= job.total };
  }

  function finish() {
    if (!job) throw new Error('no collection in progress; call begin first');
    if (job.index < job.total) {
      throw new Error('collection incomplete: ' + job.index + '/' + job.total);
    }
    var out = job.out;
    var view = job.view;
    if (job.kind === 'sheet') {
      var rows = 0;
      for (var i = 0; i < job.tables.length; i += 1) rows += job.tables[i].rows;
      view = {
        sheet: {
          tables: job.tables.length,
          rows: rows,
          digest: digest(job.tables),
          first: job.tables[0] || null
        },
        kind: 'sheet',
        detected: true,
        app: job.app
      };
    }
    out.view = view;
    out.detected = !!out.mounted && !!view.detected;
    out.digest = digest({
      url: out.url, mounted: out.mounted, tabs: out.tabs, view: view, panel: out.panel, decision: out.decision
    });
    var store = readStore();
    store[out.label] = out;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private mode */ }
    job = null;
    return send(out).then(function () { return out; });
  }

  // Load a build and take the first slice in one call. Then call `step` until
  // `done`, and `finish` to write the dump.
  function runChunked(url, label, budgetMs) {
    return loadBuild(url).then(waitForRoot).then(function () {
      var opened = begin(label);
      var progress = step(budgetMs);
      return { kind: opened.kind, index: progress.index, total: progress.total, done: progress.done };
    });
  }

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function waitForRoot() {
    return new Promise(function (resolve) {
      var started = Date.now();
      (function poll() {
        if (document.querySelector('#sd-root') || Date.now() - started > WAIT_MS) resolve(!!document.querySelector('#sd-root'));
        else setTimeout(poll, 100);
      })();
    });
  }

  function loadBuild(url) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('#sd-root')) {
        reject(new Error('a rebuild is already mounted; reload the page first'));
        return;
      }
      var script = document.createElement('script');
      script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('could not load ' + url)); };
      document.head.appendChild(script);
    });
  }

  // Drop the overlay and its stylesheet so the next build can mount where the
  // previous one stood. Used by `restart`; a reload is still the cleanest way to
  // compare two builds, and `run` refuses to stack.
  function teardown() {
    var root = document.querySelector('#sd-root');
    if (root) root.remove();
    var style = document.getElementById('sd-styles');
    if (style) style.remove();
    document.documentElement.classList.remove('sd-app');
    document.documentElement.removeAttribute('data-sd-theme');
  }

  function restart(url, label) {
    teardown();
    return run(url, label);
  }

  // Load one build, read the page, send the dump to the dev server. Returns the
  // dump so an automation `evaluate` can print it as well.
  function run(url, label) {
    return loadBuild(url)
      .then(waitForRoot)
      .then(function () { return collect(label); })
      .then(function (dump) {
        return send(dump).then(function () { return dump; });
      });
  }

  // Best effort: the page is https and the server is loopback, so this is a
  // `no-cors` POST whose opaque response cannot be read — the file on disk is the
  // receipt.
  function send(dump) {
    var body = JSON.stringify(dump);
    return fetch(POST_TO + encodeURIComponent(dump.label), {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: body
    }).then(function () { return true; }, function () { return false; });
  }

  // A readable summary without leaving the page: versions, view kinds and the
  // digests, plus any section that differs.
  function report(a, b) {
    var store = readStore();
    var labels = Array.prototype.slice.call(arguments);
    if (!labels.length) labels = Object.keys(store);
    if (labels.length < 2) return { ok: false, reason: 'need two dumps; got ' + labels.length };
    var left = store[labels[0]];
    var right = store[labels[1]];
    if (!left || !right) return { ok: false, reason: 'missing dump ' + (!left ? labels[0] : labels[1]) };
    var same = left.digest === right.digest;
    return {
      ok: same,
      left: { label: left.label, foot: left.foot, theme: left.theme, digest: left.digest, view: left.view && left.view.kind },
      right: { label: right.label, foot: right.foot, theme: right.theme, digest: right.digest, view: right.view && right.view.kind }
    };
  }

  function dump(label) {
    var store = readStore();
    return JSON.stringify(label ? store[label] : store, null, 2);
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
    return true;
  }

  // Both builds on the same page, one after the other: current, then main, so a
  // shape needs one navigation instead of two. `run` posts each dump.
  async function pair(currentUrl, mainUrl, label) {
    const current = await run(currentUrl, label + '-current');
    teardown();
    await new Promise((r) => setTimeout(r, 250));
    const main = await run(mainUrl, label + '-main');
    return { current, main };
  }

  window.sdParity = {
    run: run,
    restart: restart,
    pair: pair,
    teardown: teardown,
    collect: collect,
    begin: begin,
    step: step,
    finish: finish,
    runChunked: runChunked,
    report: report,
    dump: dump,
    send: function (label) { return send(readStore()[label]); },
    clear: clear
  };
}());
