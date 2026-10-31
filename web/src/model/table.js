// One table, read the same way everywhere a panel or a report prints one.
//
// This lived in `tabs.js`, which is a view module: the sheet and report readers
// imported a table parser out of the tab renderer. Moved here unchanged, so the
// three callers share one parser instead of one of them owning it by accident.

import { qs, textOf } from '../lib/shell.js';

// A panel is a tab: not the whole record, so it is not paged like a list.
const MAX_ROWS = 300;

const isRight = (el) => /(^|\s)AR(\s|$)/.test((el && el.getAttribute('class')) || '');

function cellOf(td, index, rightCols) {
  const anchor = qs(td, 'a[href]');
  // A calendar cell carries the class link *plus* the app's hidden tooltip,
  // which repeats the class, its instructor, its studio and its seats. The
  // link's own words are the readable part; the tooltip is read properly by the
  // week view, not echoed here.
  const raw = anchor ? textOf(anchor) : textOf(td);
  return {
    text: raw.replace(/^(\d{1,2}:\d{2}\s*[ap]\.?m?\.?)(?=[A-Za-z\u2013-])/i, '$1 ').replace(/\s+/g, ' ').trim(),
    href: anchor ? anchor.getAttribute('href') : null,
    // The app right-aligns its action column on the heading (`th.AR`) and only
    // sometimes repeats it on the cells, so the column is what is remembered.
    right: rightCols.has(index) || isRight(td)
  };
}

export function readTable(table) {
  const rows = [];
  const rightCols = new Set();
  let headings = [];
  // Every data row on the page, including the ones past MAX_ROWS: a view that
  // shows 300 of 1,142 rows has to be able to say so.
  let rowTotal = 0;
  // A table can have two heading rows: a single-cell title ("Current Class
  // Roster") and then the real columns, date by date, on `PrintClassRoster`. The
  // widest heading row is the column labels; the single-cell ones are a caption,
  // because one heading over ten cells misaligns every row.
  const captionRows = [];
  let headingWidth = 0;

  for (const tr of Array.from(table.children).flatMap((c) =>
    c.tagName === 'TBODY' || c.tagName === 'THEAD' ? Array.from(c.children) : [c]
  )) {
    if (tr.tagName !== 'TR') continue;

    // Only this table's rows: a panel can nest a table inside a cell.
    if (tr.closest && tr.closest('table') !== table) continue;

    const head = Array.from(tr.children).filter((c) => c.tagName === 'TH');
    if (head.length) {
      if (head.length > headingWidth) {
        // A one-cell row seen before the real columns was the title, not the
        // headings: it becomes the caption instead of being dropped.
        if (headingWidth === 1 && headings.length === 1 && headings[0]) captionRows.push(headings[0]);
        headingWidth = head.length;
        headings = head.map(textOf);
        rightCols.clear();
        head.forEach((th, i) => { if (isRight(th)) rightCols.add(i); });
      } else if (head.length === 1 && head.length < headingWidth) {
        captionRows.push(textOf(head[0]));
      }
      continue;
    }

    const cells = Array.from(tr.children).filter((c) => c.tagName === 'TD');
    if (!cells.length) continue;
    rowTotal += 1;
    if (rows.length >= MAX_ROWS) continue;
    rows.push(cells.map((td, i) => cellOf(td, i, rightCols)));
  }

  return {
    id: table.id || '',
    cls: (table.getAttribute('class') || '').trim(),
    headings,
    // The title row above the columns, when the app prints one.
    caption: captionRows.join(' ').trim(),
    rows,
    rowTotal
  };
}
