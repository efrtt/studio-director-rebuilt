/*
 * Crawl every page of the admin app and record STRUCTURE ONLY.
 *
 * Paste this whole file into the browser console while signed in, then run:
 *
 *   sdCrawl()             // walks up to 400 page shapes
 *   sdCrawl()             // again: continues where it stopped
 *   sdCrawlSave()         // downloads the result so far
 *   sdCrawl({ fresh: true }) // forget the map and start over
 *   sdCrawl({ all: true })   // also follow delete/charge/email pages (see below)
 *   sdScrape.results      // the last crawl, in memory
 *
 * The queue, the shapes already visited and everything collected live on in
 * this closure, so reaching the cap is not a dead end: run it again.
 *
 * What it does
 *   - Starts at the page you are on, follows the rail, the top bar, every link
 *     and every action button inside the content, and follows what those pages
 *     link to, breadth first.
 *   - Visits each *page shape* once, not each record: `?page=EditClass&cident=…`
 *     is crawled for one class only, because every class page has the same
 *     shape. That keeps a whole-site crawl to tens of requests, not thousands.
 *   - Records the tab labels and the tab panels the page carries, so subpages
 *     like Enrollment show up even when they are hidden until clicked.
 *
 * What it never does
 *   - No writes: GET only, no fetch with a method, no form submit, no POST.
 *   - No destructive navigation: any target whose page name looks like an
 *     action (delete, remove, refund, charge, send, logout, …) is listed under
 *     `skipped` and never requested. `{ all: true }` follows those too and
 *     marks them `risky` in the result. Sign-out and sign-in pages are always
 *     refused: the crawl would end its own session and then describe login
 *     shells for every shape after that.
 *   - No cell text: table headings are the app's own column labels and are
 *     kept; the text inside cells, panels and forms is never read. That is why
 *     the result contains no names, balances or email addresses.
 *
 * The result is a JSON file the rebuilt UI can be written from: one entry per
 * screen, with its tables, columns, controls, tabs and outgoing links.
 */
(function sdScrapeAll() {
  'use strict';

  var START = '[sd] crawl - structure only, no cell text';

  // Page names that do something when fetched. Recorded, never followed: a
  // crawl must not be able to delete a family or send a letter.
  //
  // Verbs only. A *compose* screen (EmailClass, EmailTextHome) is a plain GET
  // and is crawled; the page that actually sends is not. The charge landing
  // page (ChargesHome) is navigation, not a charge.
  var UNSAFE = /\b(delete|remove|drop|destroy|void|refund|send|payment|charge|submit|cancel|logout|signout|login|unsubscribe|reset|import|upload|clear|merge|clone|duplicate)\b/i;

  // Page names are camel case, so the verb has to be found inside a word:
  // `ProcessPayment` is split to `Process Payment` before the test.
  function isUnsafeName(name) {
    var spaced = String(name || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_.\-]+/g, ' ');
    return UNSAFE.test(spaced);
  }

  // The one set that is refused even by `{ all: true }`: these end or start a
  // session, and a crawl that logs itself out describes the login page for
  // every shape after the first. Nothing else is hard-blocked.
  var NEVER = /\b(logout|logoff|signout|signoff|login)\b/i;

  function isNeverName(name) {
    var spaced = String(name || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_.\-]+/g, ' ');
    return NEVER.test(spaced);
  }

  // A whole-site crawl is a few hundred shapes; the cap only exists so a run
  // cannot spin forever if the app links to an endless parameter space.
  var MAX_PAGES = 400;
  var DELAY_MS = 120;
  // Record pages carry ~45 anchors (the bar, the pager, row links), so the cap
  // has to leave room for the bar's own controls.
  var MAX_ACTIONS = 60;
  var MAX_CONTROLS = 40;

  /* ------------------------------- helpers -------------------------------- */

  function cls(el) {
    return String((el && (el.className || el.getAttribute && el.getAttribute('class'))) || '')
      .replace(/\s+/g, ' ').trim();
  }

  function labelOf(el) {
    if (!el) return '?';
    var s = String(el.tagName || '').toLowerCase();
    if (el.id) s += '#' + el.id;
    var c = cls(el);
    if (c) s += '.' + c.split(' ').join('.');
    return s;
  }

  // App label text: headings, column labels, tab names, button captions.
  function textOf(el) {
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function urlOf(href, base) {
    try {
      return new URL(href, base);
    } catch (e) {
      return null;
    }
  }

  function paramKeys(url) {
    var keys = [];
    url.searchParams.forEach(function (value, key) {
      if (value !== '' && keys.indexOf(key) < 0) keys.push(key);
    });
    return keys.sort();
  }

  // Parameters that pick a screen or filter one, never a record: two families
  // differ by their id, not by which tab the rail sent you from.
  var NAV_PARAMS = ['page', 'clicktab', 'filter', 'searchtext', 'searchidx'];

  function recordKeys(url) {
    var u = url instanceof URL ? url : urlOf(url, location.href);
    if (!u) return [];
    return paramKeys(u).filter(function (k) { return NAV_PARAMS.indexOf(k.toLowerCase()) < 0; });
  }

  // A shape is the screen, not the record: page name plus the *names* of the
  // parameters, so every family page hashes to the same key.
  function shapeOf(url) {
    var u = url instanceof URL ? url : urlOf(url, location.href);
    if (!u) return '?';
    var page = u.searchParams.get('page') || u.pathname.split('/').pop();
    var keys = recordKeys(u).sort();
    return page + (keys.length ? '(' + keys.join(',') + ')' : '');
  }

  // Only the admin shell of this same install is crawlable.
  function adminBase(url) {
    var u = urlOf(url, location.href);
    if (!u) return null;
    var dir = u.pathname.replace(/[^/]*$/, '');
    return u.origin + dir;
  }

  function pageNameOf(url) {
    var u = url instanceof URL ? url : urlOf(url, location.href);
    return u ? (u.searchParams.get('page') || '') : '';
  }

  // Anything that is not a same-install GET navigation is refused.
  function safeTarget(href, base) {
    if (!href) return null;
    var raw = String(href).trim();
    if (!raw || raw === '#' || /^(javascript|mailto|tel):/i.test(raw)) return null;
    var u = urlOf(raw, base);
    if (!u) return null;
    var never = isNeverName(pageNameOf(u)) || isNeverName(u.pathname.split('/').pop());
    var here = urlOf(base || location.href, location.href);
    if (!here || u.origin !== here.origin) return null;
    var dir = here.pathname.replace(/[^/]*$/, '');
    if (u.pathname.indexOf(dir) !== 0 || !/\.sd$/i.test(u.pathname)) return null;
    if (isUnsafeName(pageNameOf(u)) || isUnsafeName(u.pathname.split('/').pop())) {
      return { url: u.href, unsafe: true, never: never };
    }
    return { url: u.href, unsafe: false, never: never };
  }

  /* ---------------------------- page description --------------------------- */

  function tableSummary(table, index) {
    var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
    var body = rows.filter(function (r) { return r.querySelector('td'); });
    var head = rows.find(function (r) { return r.querySelector('th'); });
    var first = body[0];
    var links = table.querySelectorAll('a[href]');
    return {
      index: index,
      cls: labelOf(table),
      rows: body.length,
      headings: head
        ? Array.prototype.map.call(head.querySelectorAll('th'), textOf)
        : [],
      cellTags: first
        ? Array.prototype.map.call(first.children, function (c) { return String(c.tagName).toLowerCase(); })
        : [],
      cellClasses: first
        ? Array.prototype.map.call(first.children, function (c) { return cls(c) || '-'; })
        : [],
      linkPages: Array.prototype.slice.call(links, 0, 8).map(function (a) {
        return pageNameOf(a.getAttribute('href')) || '(no page param)';
      }),
      links: links.length
    };
  }

  function controlSummary(el) {
    var tag = String(el.tagName || '').toLowerCase();
    return {
      tag: tag,
      id: el.id || '',
      name: el.getAttribute ? (el.getAttribute('name') || '') : '',
      type: tag === 'select' ? 'select' : (el.type || 'text'),
      options: tag === 'select' ? el.options.length : undefined,
      rows: tag === 'textarea' ? el.rows : undefined,
      checked: tag === 'input' && (el.type === 'checkbox' || el.type === 'radio') ? !!el.checked : undefined
    };
  }

  function tabSummary(doc) {
    var tabs = Array.prototype.slice.call(doc.querySelectorAll('.tabContainer > *, .tab, .tabButton'));
    return tabs.map(function (t) {
      return { label: textOf(t), selected: /selected|active/i.test(cls(t)), cls: cls(t) || '' };
    });
  }

  // Tab panels usually ship inside the page, hidden with display:none, so one
  // fetch sees every subpage the editor has.
  function panelSummary(doc) {
    var panels = Array.prototype.slice.call(
      doc.querySelectorAll('.tabContent, [id^="tabContent"], .tabPanel, .tabBody')
    );
    return panels.map(function (p) {
      var tables = p.querySelectorAll('table');
      var firstHeading = tables[0] ? p.querySelector('table th') : null;
      return {
        id: p.id || '',
        cls: cls(p) || '',
        visible: p.style ? p.style.display !== 'none' : true,
        tables: tables.length,
        rows: p.querySelectorAll('tr').length,
        controls: p.querySelectorAll('input,select,textarea,button').length,
        headings: Array.prototype.map.call(
          p.querySelectorAll('table th'), textOf
        ).slice(0, 12),
        firstHeading: textOf(firstHeading)
      };
    });
  }

  function actionSummary(root, base) {
    // Not just anchors: the screens the app builds with its own JS (the enroll
    // step) use `div.Btn[onclick]` with no href, and reading only anchors made
    // those pages look like they had no button at all.
    //
    // `[onclick]` on its own is too wide — it also matches the record tabs, the
    // password eye icons and in-place phone labels — so the element has to look
    // like a button and the known parts-of-a-screen are skipped.
    //
    // Every anchor, not just `a[href]`: the record bar's Save and Delete are
    // `<a id="save" onclick="StudioDir.onSubmit('SaveStudent')">` with **no
    // href at all**, which is why a crawl built on `a[href]` could never see
    // Save on any record page.
    var nodes = Array.prototype.slice.call(
      root.querySelectorAll('a, button, input[type="button"], input[type="submit"], div[onclick], span[onclick], li[onclick], .Btn, .BtnOutln')
    );
    var out = [];
    nodes.forEach(function (el) {
      // Record links are handled as crawl targets, not actions.
      if (el.tagName === 'A' && el.closest && el.closest('.searchResultList')) return;
      if (el.tagName === 'A' && el.closest && el.closest('#sideNavBar, .topBarContainer')) return;
      // An anchor with neither an href nor a handler is not a control of anything.
      if (el.tagName === 'A' && el.getAttribute('href') == null && !el.getAttribute('onclick')) return;
      // Tabs, eye icons and menu toggles are parts of the page, not controls.
      if (el.closest && el.closest('.tab, .tabButton, .selectedTab, .table-field-icon, .menuLink, .Tooltip')) return;
      // A wrapper that carries the handler for a real control inside it (a div
      // with an onclick around a link) is not a second control.
      if (el.querySelector && el.querySelector('a[href], button, .Btn, .BtnOutln')) return;
      if (out.length >= MAX_ACTIONS) return;
      var href = el.tagName === 'A' ? el.getAttribute('href') : null;
      var target = href ? safeTarget(href, base) : null;
      var onclick = el.getAttribute && el.getAttribute('onclick');
      out.push({
        tag: String(el.tagName).toLowerCase(),
        id: el.id || '',
        cls: cls(el) || '',
        // The attribute itself, empty when there is none. Worth recording: an
        // anchor with an onclick and *no* href (Save, Delete, More) was
        // invisible to a crawl built on `a[href]`, and only this field tells
        // those apart from an `href="#"` one that was already captured.
        href: el.getAttribute('href') == null ? null : el.getAttribute('href'),
        label: (el.value || textOf(el) || el.getAttribute('title') || '').slice(0, 60),
        page: target ? pageNameOf(target.url) : '',
        params: target ? paramKeys(urlOf(target.url, base)) : [],
        // No GET behind it (`href="#"` or a plain button): the app's own JS
        // drives it, so it is named here and the screen behind it is captured
        // by hand rather than guessed at.
        js: !target,
        onclick: onclick ? String(onclick).replace(/\s+/g, ' ').slice(0, 120) : ''
      });
    });
    return out;
  }

  function linkShapes(root, base, skipNav) {
    var seen = {};
    Array.prototype.slice.call(root.querySelectorAll('a[href]')).forEach(function (a) {
      if (skipNav && a.closest && a.closest('#sideNavBar, .topBarContainer')) return;
      var t = safeTarget(a.getAttribute('href'), base);
      // Every way into the crawl goes through this list, so the `all` opt-in has
      // to be honoured here too: dropping unsafe targets here made the option
      // apply to the entry page only.
      if (!t || t.never || (t.unsafe && !state.followAll)) return;
      seen[shapeOf(t.url)] = t.url;
    });
    return seen;
  }

  // Order matters: a record page can carry a week table (a class's Calendar
  // tab) and a list panel, so the record is checked before the week.
  function kindOf(doc, url) {
    var isRecord = /^Edit/i.test(pageNameOf(url)) || recordKeys(url).length > 0;
    var hasPanel = !!doc.querySelector('#idSearchSpan .searchResultList .searchResultItem');
    if (hasPanel) return isRecord ? 'record+list' : 'list';
    if (isRecord) return 'record';
    if (doc.querySelector('table.TimeBlock')) return 'week';
    if (/has been\s+(updated|saved|added|created|deleted|removed)/i.test(
      textOf(doc.querySelector('.Content') || doc.body || doc).slice(0, 400)
    )) return 'confirmation';
    if (doc.querySelector('.ReportName, .reportHeader, table.report')) return 'report';
    if (doc.querySelector('table.FormEx, table.Form')) return 'form';
    return 'page';
  }

  // Pure: doc + url in, a structure-only description out. No cell text.
  function describeDoc(doc, url) {
    var base = String(url || location.href);
    var u = urlOf(base, base) || urlOf(location.href, location.href);
    var root = doc.querySelector('.contentContainer')
      || doc.querySelector('#mainContent')
      || doc.body;

    var controls = Array.prototype.slice.call(
      (root || doc).querySelectorAll('input,select,textarea,button')
    ).filter(function (el) { return el.type !== 'hidden'; });

    var tables = Array.prototype.slice.call((root || doc).querySelectorAll('table'));

    return {
      url: base,
      page: pageNameOf(base),
      params: paramKeys(u),
      shape: shapeOf(base),
      title: textOf(doc.querySelector('.formTitle, .ReportName, h1')),
      breadcrumb: Array.prototype.map.call(doc.querySelectorAll('.Breadcrumb a'), textOf),
      kind: kindOf(doc, base),
      counts: {
        tables: tables.length,
        rows: (root || doc).querySelectorAll('tr').length,
        controls: controls.length,
        links: (root || doc).querySelectorAll('a[href]').length,
        forms: doc.querySelectorAll('form').length
      },
      tables: tables.map(tableSummary),
      controls: controls.slice(0, MAX_CONTROLS).map(controlSummary),
      controlsTotal: controls.length,
      tabs: tabSummary(doc),
      panels: panelSummary(doc),
      actions: actionSummary(root || doc, base),
      // Links inside the content, and the rail separately: a page reached from
      // a list has to be able to reveal the rest of the app, not just its own
      // neighbourhood.
      linkShapes: linkShapes(root || doc, base, true),
      navShapes: linkShapes(
        doc.querySelector('#sideNavBar') || doc.querySelector('.topBarContainer') || doc.body,
        base
      )
    };
  }

  /* --------------------------------- crawl -------------------------------- */

  // The crawl survives its own runs: the queue, what has been visited and what
  // was collected all live here. Reaching the cap (or pressing stop) leaves the
  // rest queued, and calling sdCrawl() again continues instead of starting over.
  var state = {
    running: false,
    stop: false,
    results: null,
    queue: [],
    queued: {},
    crawled: {},
    pages: [],
    skipped: [],
    errors: [],
    // Pages followed only because the run asked for `all`, so the map can say
    // which entries were taken from a name that normally means "do something".
    risky: [],
    followAll: false
  };

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function fetchDoc(url) {
    var res = await fetch(url, { credentials: 'same-origin', redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
    var html = await res.text();
    var doc = new DOMParser().parseFromString(html, 'text/html');
    return { doc: doc, html: html, finalUrl: res.url || url };
  }

  async function crawl(options) {
    if (state.running) {
      console.warn('[scrape] already running - sdCrawlStop() to stop');
      return state.results;
    }
    var opts = options || {};
    var max = opts.max || MAX_PAGES;
    var delay = opts.delay == null ? DELAY_MS : opts.delay;
    state.followAll = !!opts.all;

    state.running = true;
    state.stop = false;

    if (opts.fresh) reset();

    var queue = state.queue;
    var queued = state.queued;
    var crawled = state.crawled;
    var pages = state.pages;
    var skipped = state.skipped;
    var errors = state.errors;
    var risky = state.risky;

    function enqueue(target, from) {
      // A sign-out page is refused even when the run asks for everything.
      if (!target || target.never) return;
      if (target.unsafe && !state.followAll) return;
      var url = target.url;
      var shape = shapeOf(url);
      if (queued[shape]) return;
      queued[shape] = true;
      queue.push({ url: url, shape: shape, from: from || '' });
    }

    // Seeds only on the first run: a resumed crawl continues its queue, and
    // re-seeding would describe the page you happen to be on twice.
    if (!pages.length) {
      var live = describeDoc(document, location.href);
      enqueue({ url: location.href, unsafe: false }, '(start)');
      crawled[live.shape] = true;
      pages.push(live);

      Array.prototype.slice.call(document.querySelectorAll('a[href]')).forEach(function (a) {
        var t = safeTarget(a.getAttribute('href'), location.href);
        if (!t) return;
        if (t.unsafe && !state.followAll) {
          if (skipped.length < 60) {
            skipped.push({ label: textOf(a).slice(0, 60), page: pageNameOf(t.url), url: t.url, from: location.href, why: 'unsafe page name' });
          }
          return;
        }
        if (t.unsafe) risky.push({ url: t.url, from: location.href });
        enqueue(t, location.href);
      });
    }

    var done = 0;
    console.log(START);
    console.log('[scrape] ' + (pages.length > 1 ? 'resuming: ' : '')
      + queue.length + ' page shapes queued from ' + location.pathname);

    while (queue.length && done < max && !state.stop) {
      var item = queue.shift();
      if (crawled[item.shape]) continue;
      crawled[item.shape] = true;
      done += 1;

      if (item.url !== location.href) {
        try {
          var page = await fetchDoc(item.url);
          var desc = describeDoc(page.doc, page.finalUrl);
          desc.fetchedFrom = item.from;
          if (isUnsafeName(desc.page)) desc.risky = true;
          pages.push(desc);

          console.log('[scrape] ' + done + '. ' + desc.shape + '  (' + desc.tables.length + ' tables, '
            + desc.controlsTotal + ' controls, ' + desc.tabs.length + ' tabs)  ' + desc.title);

          // Follow every new shape this page links to, rail included.
          Object.keys(desc.linkShapes).forEach(function (shape) {
            enqueue({ url: desc.linkShapes[shape], unsafe: false }, page.finalUrl);
          });
          Object.keys(desc.navShapes).forEach(function (shape) {
            enqueue({ url: desc.navShapes[shape], unsafe: false }, page.finalUrl);
          });
          Array.prototype.slice.call(page.doc.querySelectorAll('a[href]')).forEach(function (a) {
            var t = safeTarget(a.getAttribute('href'), page.finalUrl);
            if (t && t.unsafe && state.followAll) risky.push({ url: t.url, from: page.finalUrl });
            if (t && t.unsafe && !state.followAll && skipped.length < 60) {
              skipped.push({
                label: textOf(a).slice(0, 60), page: pageNameOf(t.url), url: t.url,
                from: page.finalUrl, why: 'unsafe page name'
              });
            }
          });
        } catch (err) {
          errors.push({ url: item.url, shape: item.shape, error: String(err && err.message || err) });
          console.warn('[scrape] failed ' + item.shape + ': ' + (err && err.message || err));
        }
        if (delay) await sleep(delay);
      }
    }

    state.running = false;

    var byKind = {};
    pages.forEach(function (p) { byKind[p.kind] = (byKind[p.kind] || 0) + 1; });

    state.results = {
      startedAt: new Date().toISOString(),
      origin: location.origin,
      entry: location.href,
      stoppedEarly: state.stop || queue.length > 0,
      remaining: queue.length,
      // What is still to visit, so a finished file says what it does not cover.
      pending: queue.map(function (item) { return { shape: item.shape, url: item.url }; }),
      counts: { pages: pages.length, skipped: skipped.length, errors: errors.length, byKind: byKind },
      followedRisky: risky,
      pages: pages,
      skipped: skipped,
      errors: errors
    };

    console.log('[scrape] done: ' + pages.length + ' pages, ' + skipped.length + ' unsafe links skipped, '
      + errors.length + ' errors' + (state.results.stoppedEarly ? ', ' + queue.length + ' shapes still queued' : ''));
    console.log('[scrape] map:');
    pages.forEach(function (p) { console.log('  ' + p.shape + '  [' + p.kind + ']  ' + p.title); });
    if (state.results.stoppedEarly) {
      console.log('[scrape] not finished: run sdCrawl() again to continue (' + queue.length + ' left), '
        + 'sdCrawl({ fresh: true }) to start over');
    }
    console.log('[scrape] run sdCrawlSave() to download, or copy(JSON.stringify(sdScrape.results))');
    return state.results;
  }

  function sdCrawlSave(results) {
    var data = results || state.results;
    if (!data) {
      console.warn('[scrape] nothing to save - run sdCrawl() first');
      return null;
    }
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pages.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    console.log('[scrape] downloaded pages.json (' + data.pages.length + ' pages)');
    return data;
  }

  function sdCrawlStop() {
    state.stop = true;
    console.log('[scrape] stopping after the current request - sdCrawl() resumes it');
  }

  function reset() {
    state.queue = [];
    state.queued = {};
    state.crawled = {};
    state.pages = [];
    state.skipped = [];
    state.errors = [];
    state.risky = [];
    state.results = null;
  }

  function sdCrawlReset() {
    reset();
    console.log('[scrape] cleared: the next sdCrawl() starts from this page');
  }

  var api = {
    crawl: crawl,
    stop: sdCrawlStop,
    reset: sdCrawlReset,
    save: sdCrawlSave,
    describeDoc: describeDoc,
    shapeOf: shapeOf,
    safeTarget: safeTarget,
    results: null
  };
  // `results` is a live view of the last crawl, not a copy.
  Object.defineProperty(api, 'results', { get: function () { return state.results; } });

  var g = typeof window !== 'undefined' ? window : globalThis;
  g.sdScrape = api;
  g.sdCrawl = crawl;
  g.sdCrawlSave = sdCrawlSave;
  g.sdCrawlStop = sdCrawlStop;
  g.sdCrawlReset = sdCrawlReset;

  console.log('[scrape] ready. Run sdCrawl() to map every page (GET only, no writes).');
  return api;
})();
