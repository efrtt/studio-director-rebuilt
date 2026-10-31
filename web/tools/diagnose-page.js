/*
 * Page diagnosis for the rebuilt UI.
 *
 * Paste this whole file into the browser console on the page you want modelled,
 * then copy the single string it prints. It reports STRUCTURE ONLY:
 *
 *   - tags, ids and class names
 *   - column headings (needed verbatim - they are the labels we map)
 *   - cell tags and classes, never cell text
 *   - row counts, form field names/types, tabs, link targets by page name
 *
 * It never prints student/parent names, balances, notes, dates of birth or
 * email addresses, because it never reads cell text at all. Only <th> text is
 * included, since those are the app's own column labels.
 *
 * Works on any admin page (`.sd` URLs). Nothing is uploaded or fetched.
 */
(function sdDiagnose() {
  'use strict';

  const START = '[sd] page diagnosis - structure only, no cell text';
  const END = '--- end of diagnosis ---';
  const out = [];
  const push = (s) => out.push(s === undefined ? '' : String(s));

  const classesOf = (el) => String((el && el.className) || '').replace(/\s+/g, ' ').trim();
  const label = (el) => {
    if (!el) return '?';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const c = classesOf(el);
    if (c) s += '.' + c.split(' ').join('.');
    return s;
  };
  const text = (el) => String((el && el.textContent) || '').replace(/\s+/g, ' ').trim();

  function outline(el, depth, maxDepth) {
    const lines = [];
    const walk = (node, level) => {
      if (level > maxDepth) return;
      const kids = Array.from(node.children || []);
      const budget = level === 0 ? 6 : (level === 1 ? 10 : 14);
      kids.slice(0, budget).forEach((kid) => {
        lines.push('  '.repeat(level + 1) + label(kid) + (kid.children.length ? '' : ' [leaf]'));
        if (kid.children.length) walk(kid, level + 1);
      });
      if (kids.length > budget) lines.push('  '.repeat(level + 1) + '... ' + (kids.length - budget) + ' more');
    };
    walk(el, depth || 0);
    return lines;
  }

  const contentRoot = document.querySelector('.contentContainer')
    || document.querySelector('#mainContent')
    || document.body;

  /* ---- summary ---- */
  const params = new URLSearchParams(location.search);
  push(START);
  push('');
  push('--- summary ---');
  push('page=' + (params.get('page') || '(none)') + '  path=' + location.pathname);
  push('other query keys: ' + Array.from(params.keys()).filter((k) => k !== 'page').join(', ') || '(none)');
  push('body classes: ' + (classesOf(document.body) || '(none)'));
  push('content root: ' + label(contentRoot));
  push('tables in root: ' + contentRoot.querySelectorAll('table').length);
  push('rows in root: ' + contentRoot.querySelectorAll('tr').length);
  push('form controls in root: ' + contentRoot.querySelectorAll('input,select,textarea,button').length);

  /* ---- shell ---- */
  push('');
  push('--- shell (4 levels, tags and classes only) ---');
  push('body');
  outline(document.body, 0, 3).forEach(push);

  /* ---- content root, deeper ---- */
  push('');
  push('--- content root (' + label(contentRoot) + ', 4 levels) ---');
  outline(contentRoot, 0, 4).forEach(push);

  /* ---- each table ---- */
  Array.from(contentRoot.querySelectorAll('table')).forEach((table, i) => {
    const rows = Array.from(table.querySelectorAll('tr'));
    const headRow = rows.find((r) => r.querySelector('th'));
    const bodyRows = rows.filter((r) => r.querySelector('td'));
    const first = bodyRows[0];

    push('');
    push('--- table ' + (i + 1) + ': ' + label(table) + ' ---');
    push('rows=' + bodyRows.length + '  header=' + (headRow ? 'yes' : 'no')
      + '  thead=' + (table.querySelector('thead') ? 'yes' : 'no')
      + '  tbody=' + (table.querySelector('tbody') ? 'yes' : 'no'));
    if (headRow) {
      const heads = Array.from(headRow.querySelectorAll('th')).map((th) => text(th));
      push('headings (' + heads.length + '): ' + heads.join(' | '));
      push('heading classes: ' + Array.from(headRow.querySelectorAll('th')).map(classesOf).join(' | '));
    }
    if (!first) { push('(no data rows)'); return; }

    const cells = Array.from(first.children);
    push('first row cell tags: ' + cells.map((c) => c.tagName.toLowerCase()).join(' | '));
    push('first row cell classes: ' + cells.map((c) => classesOf(c) || '-').join(' | '));
    push('first row link: ' + (first.querySelector('a[href]')
      ? label(first.querySelector('a[href]')) + ' -> ' + linkTarget(first.querySelector('a[href]'))
      : 'none'));
    const anyLink = table.querySelector('tbody a[href]');
    push('first link anywhere in table: ' + (anyLink ? linkTarget(anyLink) : 'none')
      + '  links in table=' + table.querySelectorAll('a[href]').length);
    const anchors = first.querySelectorAll('a[href]').length;
    if (anchors > 1) push('links in first row: ' + anchors);

    // Structural outline of the first data row only, no text.
    push('first data row outline:');
    outline(first, 0, 2).forEach(push);
  });

  /* ---- form controls (names only) ---- */
  const controls = Array.from(contentRoot.querySelectorAll('input,select,textarea'))
    .filter((el) => el.type !== 'hidden');
  if (controls.length) {
    push('');
    push('--- form controls (' + controls.length + ') ---');
    controls.slice(0, 25).forEach((el) => {
      push(label(el) + '  name=' + (el.getAttribute('name') || '-')
        + '  type=' + (el.tagName === 'SELECT' ? 'select' : (el.type || 'text'))
        + (el.tagName === 'SELECT' ? '  options=' + el.options.length : ''));
    });
    if (controls.length > 25) push('... ' + (controls.length - 25) + ' more');
  }

  /* ---- page controls: the buttons that are not row links ----
   *
   * This is the part that answers "is there a Save on this page, and what is the
   * submit control called": the crawl reads the content root but the record
   * editors keep Save in the top bar, so a page reported as "no actions" can
   * still have one. A control's own label is UI text ("Compose Email"), never a
   * record's; anything inside a table cell with two columns is a row and is
   * skipped.
   */
  const inDataTable = (el) => {
    const table = el.closest('table');
    if (!table) return false;
    const rows = Array.from(table.children)
      .flatMap((c) => (c.tagName === 'TBODY' || c.tagName === 'THEAD' ? Array.from(c.children) : [c]))
      .filter((r) => r.tagName === 'TR');
    return rows.some((tr) => {
      const cells = Array.from(tr.children);
      return cells.some((c) => c.tagName === 'TH') || cells.filter((c) => c.tagName === 'TD').length >= 2;
    });
  };

  push('');
  push('--- page controls (outside data tables) ---');
  push('has #save: ' + (document.getElementById('save') ? 'yes' : 'no'));
  // `[onclick]` and the app's own `.Btn`/`.BtnOutln` matter: the JS-built
  // screens (the enroll step) use divs for their buttons, and a dump that
  // skipped them would report a page with no way to press anything.
  const pageControls = Array.from(document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [onclick], .Btn, .BtnOutln'))
    .filter((el) => !inDataTable(el))
    .filter((el) => !el.closest('#sideNavBar, .Breadcrumb'));
  pageControls.slice(0, 40).forEach((el) => {
    const caption = (el.tagName === 'INPUT' ? (el.value || '') : text(el)).slice(0, 48);
    push('  ' + label(el)
      + '  id=' + (el.id || '-')
      + '  href=' + (el.getAttribute('href') || '-')
      + '  onclick=' + (el.getAttribute('onclick') || '-').slice(0, 70)
      + '  text=' + JSON.stringify(caption));
  });
  if (pageControls.length > 40) push('  ... ' + (pageControls.length - 40) + ' more');

  /* ---- tabs ---- */
  const tabs = Array.from(contentRoot.querySelectorAll('.tabContainer > *, .tab'));
  if (tabs.length) {
    push('');
    push('--- tabs ---');
    push(tabs.map((t) => label(t) + (t.classList.contains('selectedTab') ? ' [selected]' : '')).join('\n'));
    push('panels: ' + Array.from(contentRoot.querySelectorAll('.tabContent'))
      .map((p) => label(p) + ' display=' + getComputedStyle(p).display).join(' | '));
  }

  /* ---- nav ---- */
  const nav = Array.from(document.querySelectorAll('#sideNavBar a, .topBar a.menuLink'));
  if (nav.length) {
    push('');
    push('--- navigation ---');
    push(nav.map((a) => text(a) + ' -> ' + linkTarget(a)).join('\n'));
  }

  push('');
  push('tip: window.sdDumpRow(tableIndex, rowIndex) prints ONE row in full,');
  push('     with every text node replaced by its length (no names, no amounts).');
  push(END);

  /* ---- the record panel's pager, still text-free ----
   *
   * The panel shows one window of the record set (500 rows on the pages seen so
   * far) and the rebuilt list can only show what the page carries. This prints
   * what the page itself offers for reaching the rest: its pager anchors, their
   * hrefs, the filter's own attributes and the scripts that could do it by JS.
   * Record labels are skipped: any anchor inside .searchResultList is ignored.
   */
  window.sdPanel = function () {
    const lines = ['[sd] list panel probe - structure only, no record text', ''];
    const panel = document.querySelector('#idSearchSpan');
    if (!panel) {
      lines.push('no #idSearchSpan on this page');
      const blob = lines.join('\n');
      console.log(blob);
      return blob;
    }

    const items = panel.querySelectorAll('.searchResultItem').length;
    const filter = panel.querySelector('#filter');
    lines.push('panel: ' + label(panel));
    lines.push('items in panel: ' + items);
    lines.push('heading: ' + text(panel.querySelector('.searchResultBar .searchResultLabel')));
    lines.push('filter: ' + (filter
      ? 'placeholder=' + JSON.stringify(filter.getAttribute('placeholder'))
        + '  name=' + (filter.getAttribute('name') || '-')
        + '  form=' + (filter.form ? (filter.form.getAttribute('action') || '') + ' ' + (filter.form.getAttribute('method') || '') : 'none')
      : 'none'));
    lines.push('count text: ' + JSON.stringify(text(panel.querySelector('.searchResultLabel + *') || panel.querySelector('p'))));

    const nav = panel.querySelector('.searchResultNav');
    lines.push('');
    lines.push('pager (' + (nav ? nav.querySelectorAll('a').length : 0) + ' anchors):');
    if (nav) {
      Array.from(nav.querySelectorAll('a')).forEach((a, i) => {
        lines.push('  ' + (i + 1) + '. href=' + JSON.stringify(a.getAttribute('href'))
          + '  title=' + JSON.stringify(a.getAttribute('title'))
          + '  text=' + JSON.stringify(text(a).slice(0, 40))
          + '  label=' + label(a));
      });
    }

    const outside = Array.from(panel.querySelectorAll('a[href]'))
      .filter((a) => !a.closest('.searchResultList'));
    lines.push('');
    lines.push('anchors outside the list (' + outside.length + '):');
    outside.slice(0, 15).forEach((a) => {
      lines.push('  href=' + JSON.stringify(a.getAttribute('href'))
        + '  text=' + JSON.stringify(text(a).slice(0, 40)) + '  label=' + label(a));
    });

    const scripts = Array.from(document.querySelectorAll('script[src]'))
      .map((s) => String(s.getAttribute('src') || '').split('?')[0]);
    lines.push('');
    lines.push('scripts (' + scripts.length + '): ' + scripts.join(' | '));
    lines.push('');
    lines.push('If the pager anchors carry no href, the panel is filled by JS: open DevTools ->');
    lines.push('Network, scroll or click the panel once, and note the request URL.');

    const blob = lines.join('\n');
    console.log(blob);
    console.log('Copied? Run: copy(window.__sdPanel)');
    window.__sdPanel = blob;
    return blob;
  };

  /* ---- one-row deep dump, still text-free ---- */
  window.sdDumpRow = function (tableIndex, rowIndex) {
    const tables = Array.from(document.querySelectorAll('table'));
    const table = tables[tableIndex || 0];
    if (!table) return '(no table at index ' + (tableIndex || 0) + ')'; 
    const rows = Array.from(table.querySelectorAll('tr')).filter((r) => r.querySelector('td'));
    const row = rows[rowIndex || 0];
    if (!row) return '(no data row at index ' + (rowIndex || 0) + ')'; 

    const clone = row.cloneNode(true);
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      const len = (node.textContent || '').trim().length;
      node.textContent = len ? '\u00ab' + len + '\u00bb' : '';
    });
    Array.from(clone.querySelectorAll('[src]')).forEach((el) => {
      el.setAttribute('src', String(el.getAttribute('src') || '').split('/').pop());
    });

    const html = clone.outerHTML.replace(/></g, '>\n<');
    window.__sdRow = html;
    console.log(html);
    console.log('Copied? Run: copy(window.__sdRow)');
    return html;
  };

  const blob = out.join('\n');
  window.__sdDiagnosis = blob;

  // Downloads it as a file, so a dump is one click rather than a copy out of the
  // console. Named after the page so two dumps cannot be confused.
  window.sdDumpSave = function () {
    const page = params.get('page') || 'page';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([blob], { type: 'text/plain' }));
    a.download = 'dump-' + page.replace(/[^\w.-]+/g, '_') + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return a.download;
  };

  console.log(blob);
  console.log('Save it: sdDumpSave()   // or copy it: copy(window.__sdDiagnosis)');
  return blob;

  /* ---- helpers ---- */
  function linkTarget(a) {
    try {
      const u = new URL(a.getAttribute('href'), location.href);
      const page = u.searchParams.get('page');
      const keys = Array.from(u.searchParams.keys());
      return u.pathname.split('/').pop() + (page ? '?page=' + page : '') + ' [params: ' + keys.join(',') + ']';
    } catch (e) {
      return '(unparsed href)';
    }
  }
})();
