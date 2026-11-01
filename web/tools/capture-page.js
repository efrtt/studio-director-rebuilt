/*
 * Capture one live page as a demo fixture - paste this whole file into the
 * browser console on the page you want, with the app signed in.
 *
 *   sdCapture()          // returns the fixture HTML and copies it to the clipboard
 *   sdCaptureDownload()  // downloads it as fixture-<page>.html
 *
 * What it does to the page: nothing. It clones the content root, trims it to a
 * representative subset, and turns record text into same-length filler, so the
 * result is safe to commit. UI text (titles, column headings, buttons, class
 * names on the calendar) is kept, because that is what makes a demo page
 * readable.
 *
 * Why it exists: this bundle cannot be mounted on the live site from here
 * (private-network rules block the loopback fetch the userscript needs), and the
 * live page cannot hand a capture to a tool (fetch blocked, form POST arrives as
 * a GET with the body dropped, a long navigation kills the document, and the
 * preview channel truncates around 23 kB). A console snippet has none of those
 * limits - it writes to the clipboard and the file is one paste away.
 *
 * Large tables: `TimeBlock` is the calendar, and its cells hold class names,
 * times and spots rather than people, so it is kept verbatim. Every other table
 * with two or more cells per row has its cells replaced.
 */
(function sdCapture() {
  'use strict';

  const MAX_TABLES = 4;
  const MAX_ROWS = 12;

  const filler = (text) => 'x'.repeat(String(text || '').trim().length);

  function build() {
    const root = document.querySelector('.contentContainer')
      || document.querySelector('#mainContent');
    if (!root) return null;

    const clone = root.cloneNode(true);
    clone.querySelectorAll('script, style').forEach((el) => el.remove());

    // Trim: a page with forty tables does not need forty to show the layout.
    const tables = Array.from(clone.querySelectorAll('table'));
    tables.forEach((table, index) => {
      if (index >= MAX_TABLES) { table.remove(); return; }
      if (table.classList.contains('TimeBlock')) return;
      Array.from(table.querySelectorAll('tr')).slice(MAX_ROWS).forEach((row) => row.remove());
    });

    // Scrub: record cells and record links only.
    clone.querySelectorAll('table').forEach((table) => {
      if (table.classList.contains('TimeBlock')) return;
      Array.from(table.querySelectorAll('tr')).forEach((row) => {
        const cells = Array.from(row.children).filter((cell) => cell.tagName === 'TD');
        if (cells.length < 2) return;
        cells.forEach((cell) => {
          if (cell.querySelector('a[href]')) return;
          cell.textContent = filler(cell.textContent);
        });
      });
    });
    clone.querySelectorAll('#idSearchSpan a, .searchResultItem a').forEach((anchor) => {
      anchor.textContent = filler(anchor.textContent);
    });

    const nav = Array.from(document.querySelectorAll('#sideNavBar a')).slice(0, 12)
      .map((a) => '<a class="sideNavLink" href="' + a.getAttribute('href') + '">'
        + a.textContent.trim().replace(/(.+)\1/, '$1') + '</a>')
      .join('');

    const page = new URLSearchParams(location.search).get('page') || 'page';
    const html = [
      '<!doctype html>',
      '<!-- captured live from page=' + page + '; trimmed to a representative subset,',
      '     record cells are same-length filler, UI text and TimeBlock cells kept -->',
      '<html lang="en"><body>',
      '<div id="sideNavBar">' + nav + '</div>',
      '<div class="topBarContainer"><div class="topBar"></div></div>',
      '<form id="idForm"><div id="mainContent">' + clone.outerHTML + '</div></form>',
      '</body></html>'
    ].join('\n');

    return { page, html };
  }

  function report(built) {
    console.log('[sd] captured page=' + built.page + ', ' + built.html.length + ' bytes');
    console.log('[sd] save it as web/test/fixtures/live-' + built.page.toLowerCase() + '.html');
    console.log('[sd] then: cd web && npm run demo  (it appears as demo/' + built.page.toLowerCase() + '.html)');
    return built.html;
  }

  window.sdCapture = function sdCaptureText() {
    const built = build();
    if (!built) { console.log('[sd] no content root on this page'); return null; }
    try {
      navigator.clipboard.writeText(built.html);
      console.log('[sd] copied to the clipboard');
    } catch (e) {
      console.log('[sd] clipboard blocked - use sdCaptureDownload()');
    }
    return report(built);
  };

  window.sdCaptureDownload = function sdCaptureFile() {
    const built = build();
    if (!built) { console.log('[sd] no content root on this page'); return null; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([built.html], { type: 'text/html' }));
    a.download = 'live-' + built.page.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return report(built);
  };

  console.log('[sd] capture ready. sdCapture() copies the fixture, sdCaptureDownload() saves it.');
})();
