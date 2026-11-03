// One table, read the same way everywhere a panel or a report prints one.
//
// This lived in `tabs.js`, which is a view module: the sheet and report readers
// imported a table parser out of the tab renderer. Moved here unchanged, so the
// three callers share one parser instead of one of them owning it by accident.

import { qs, qsa, textOf } from '../lib/shell.js';
import { moneyText } from '../lib/balance.js';

// The app marks a family that owes money with its own red span: the amount in a
// hidden tooltip and a `$` printed after it.
//
//   <a href="admin.sd?page=EditFamily&amp;fident=4401">Lovelace
//     <span class="boldRed"><span class="Tooltip">Balance due: $120.00</span>$</span></a>
//
// Reading the cell's text read the tooltip too, so the name arrived as
// "Lovelace Balance due: $120.00 $" and nothing could tell name from money. The
// span is what says which is which: its words are the balance, the rest is the
// name.
const DEBT = '.boldRed';

// The text of an element with one kind of descendant left out.
function textBesides(el, skip) {
  let out = '';
  const walk = (node) => {
    for (const child of Array.from(node.childNodes || [])) {
      if (child.nodeType === 3) {
        out += child.textContent;
        continue;
      }
      if (child.nodeType !== 1) continue;
      if (child.matches && child.matches(skip)) continue;
      walk(child);
    }
  };
  walk(el);
  return out;
}

// A panel is a tab: not the whole record, so it is not paged like a list.
const MAX_ROWS = 300;

const isRight = (el) => /(^|\s)AR(\s|$)/.test((el && el.getAttribute('class')) || '');

// A control's words: its own, else the tooltip the app puts beside an icon.
function labelOfAnchor(anchor) {
  const own = textOf(anchor);
  if (own) return own;
  const wrapper = anchor.closest ? anchor.closest('.actionIcon') : null;
  const tooltip = wrapper ? qs(wrapper, '.Tooltip') : null;
  if (tooltip) {
    const words = textOf(tooltip);
    if (words) return words;
  }
  return (anchor.getAttribute('title') || '').trim();
}

function cellOf(td, index, rightCols) {
  const anchor = qs(td, 'a[href]');
  // The app says which column is a control column: `td.action-cell` holds the
  // row's button, drawn as an icon with the label in a tooltip. Its link
  // navigates (`page=Unenroll`), so the href alone read as an ordinary link and
  // the cell never got the pill every other action column gets.
  const actionCell = /(^|\s)action-cell(\s|$)/.test(td.getAttribute('class') || '')
    || !!qs(td, '.actionIcon');
  // A calendar cell carries the class link *plus* the app's hidden tooltip,
  // which repeats the class, its instructor, its studio and its seats. The
  // link's own words are the readable part; the tooltip is read properly by the
  // week view, not echoed here.
  // An *action* cell is the opposite shape: the link is an icon and carries no
  // words at all, and the label sits beside it in a tooltip span
  // (`<a><i class="fa-xmark"></i></a><span class="Tooltip">Drop</span>`). Reading
  // only the anchor left the label empty, which rendered an invisible link in the
  // Actions column - the class enrollment page had no Drop button. An anchor with
  // words still wins, so tooltips elsewhere are not echoed.
  const debt = qs(td, DEBT);
  const dueMatch = debt ? String(textOf(debt)).match(/-?\$?\s?\d[\d,]*\.\d{2}/) : null;
  const due = dueMatch ? moneyText(dueMatch[0]) : '';

  const anchorText = anchor ? (debt ? textBesides(anchor, DEBT) : textOf(anchor)) : '';
  const raw = (anchorText || (debt ? textBesides(td, DEBT) : textOf(td))) || '';
    // A cell can hold more than one control: the waitlist offers `Enroll` and
    // `Drop` as two icon links side by side. Keeping only the first merged them
    // into a single link whose words ran together and whose target was one of
    // the two - so pressing it always went to Unenroll.
    const anchors = qsa(td, 'a[href]');
    const actions = anchors.length > 1
      ? anchors.map((a) => ({ label: labelOfAnchor(a), href: a.getAttribute('href') }))
        .filter((action) => action.label)
      : [];

    // A cell that holds nothing but the balance prints the balance. The pill is
    // for money beside a family's name: it says "this row owes" without taking
    // room from the name. On its own the amount is the whole answer — the
    // Family tab files it under "Balance Due" and nothing else is in the cell —
    // so a lone red `$` there says less than the figure does.
    const words = raw.replace(/^(\d{1,2}:\d{2}\s*[ap]\.?m?\.?)(?=[A-Za-z\u2013-])/i, '$1 ').replace(/\s+/g, ' ').trim();

    return {
    text: words || due,
    href: anchor ? anchor.getAttribute('href') : null,
      ...(actionCell ? { action: true } : {}),
    // The app right-aligns its action column on the heading (`th.AR`) and only
    // sometimes repeats it on the cells, so the column is what is remembered.
      right: rightCols.has(index) || isRight(td),
      // Only when there is something to disambiguate: one control is the cell.
      ...(actions.length ? { actions } : {}),
      // A balance this cell states, kept out of its words — but only when there
      // are words to keep it out of.
      ...(due && words ? { due } : {})
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
