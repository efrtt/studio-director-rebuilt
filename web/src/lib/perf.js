// The Performance Info list on an event page.
//
// This is the one table in the app whose *order* is data. What the app ships, for
// one event, is:
//
//   div.ReportTable                     "Performance Info"
//   table#PerfTable.ReportTable         Order, Locked, Performance Song, Class Name,
//                                       Instructor, Day, Start Time, Performance
//                                       Length, Performance Notes, (action)
//
// and each row carries its own pair of hidden inputs inside the page's form:
//
//   <td class="AR"><div class="dragable">1<input hidden name="perf901" value="1"></div></td>
//   <td><div class="link" onclick="StudioDir.ManageEvents.lock(this)"><img …></div>
//       <input hidden name="lock901" value="0"></td>
//   <td><a href="…page=ClassPerformance&meth=edit&cident=…&perf_ident=901">TBD</a></td>
//   …                                                             <a class="BtnX" href="…meth=del…">X</a>
//
// The app's own drag widget writes `perf<ident>` as rows move, and Save submits
// the form. So the rebuild arranges rows locally and, at save time, writes the
// new numbers into those same inputs (`applyOrder`) before pressing the app's
// own Save. Nothing is built here and no request is made: the app serialises its
// form exactly as it does for a click on its own Save.
//
// The three controls below the table are the page's, not ours:
//
//   Add New Performance      a real anchor (…&meth=addPerf&methargs=<event>)
//   Automatically Order …    href="#", StudioDir.onCallMethodSubmit(…)
//   Save and check …         href="#", StudioDir.onCallMethodSubmit(…)
//
// The last two are pressed on the live page (`model/press.js`), addressed by
// their own handler because their labels are unique but their `href` says
// nothing.

import { qs, qsa, textOf } from './shell.js';

// The app's own id first; the label above the table is the fallback, so a page
// that renames the table still reads.
const TITLE = /^performance info$/i;
const ACTIONS = {
  add: /^add new performance$/i,
  autoOrder: /^automatically order performances$/i,
  checkConflicts: /^save and check for conflicts$/i
};

// An event from the element's own realm: a test DOM carries its own Event
// constructor, and a global one throws on dispatch before the app ever sees it.
function announcement(element, type) {
  const view = element.ownerDocument && element.ownerDocument.defaultView;
  const Ctor = (view && view.Event) || globalThis.Event;
  try {
    element.dispatchEvent(new Ctor(type, { bubbles: true }));
  } catch (e) {
    // A realm without events still holds the value; Save reads the input itself.
  }
}

function perfTable(doc) {
  const named = qs(doc, '#PerfTable');
  if (named) return named;
  return qsa(doc, 'table.ReportTable').find((table) => {
    const above = table.previousElementSibling;
    return !!above && TITLE.test(textOf(above));
  }) || null;
}

// The ident is the whole address: every input this row needs is named after it.
function identOf(input) {
  const m = /^(?:perf|lock)(.+)$/.exec((input && input.getAttribute('name')) || '');
  return m ? m[1] : '';
}

// A control of the page's, as the press layer wants it: the handler is what
// identifies the element, since the label is the only other thing it has.
function actionIn(doc, pattern) {
  const el = qsa(doc, 'a[href], button').find((a) => pattern.test(textOf(a)));
  if (!el) return null;
  const href = el.getAttribute('href') || '';
  return {
    label: textOf(el),
    href,
    // `href="#"` or none at all: the app's own script is the control.
    js: !href || href === '#' || /^javascript:/i.test(href),
    onclick: el.getAttribute('onclick') || '',
    id: el.id || '',
    // Read from one element, so its handler addresses it exactly.
    exact: true
  };
}

// The table, or null when the page has none — the model only carries a `perf`
// key for the pages that do, so every other editor's model is byte-identical.
export function readPerf(doc) {
  const table = perfTable(doc);
  if (!table) return null;

  // Columns are read by their headings, not by position: the app has already
  // changed this table's width once, and an index would silently read the wrong
  // column the day it changes again.
  // The heading row is normally a <thead>. This app's ReportTable prints it as
  // the first body row, made of <th> cells, so both shapes are read.
  const headCells = qsa(table, 'thead th');
  const firstBody = qsa(table, 'tbody tr')[0] || null;
  const bodyCells = firstBody ? Array.prototype.slice.call(firstBody.children) : [];
  const names = headCells.length
    ? headCells
    : (bodyCells.length && bodyCells.every((cell) => cell.tagName === 'TH') ? bodyCells : []);
  const headings = names.map((th) => textOf(th).toLowerCase());
  const at = (...names) => headings.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const cols = {
    order: at('order'),
    lock: at('locked', 'lock'),
    song: at('performance song', 'song'),
    className: at('class name', 'class'),
    instructor: at('instructor'),
    day: at('day'),
    start: at('start time', 'start'),
    length: at('performance length', 'length'),
    notes: at('performance notes', 'notes')
  };
  const words = (tr, key) => {
    const index = cols[key];
    const td = index >= 0 ? tr.children[index] : null;
    return td ? textOf(td) : '';
  };

  const rows = [];
  for (const tr of qsa(table, 'tbody tr')) {
    // A nested table's rows belong to that table, not this one.
    if (tr.closest && tr.closest('table') !== table) continue;

    const orderInput = qsa(tr, 'input[name^="perf"]')[0] || null;
    // The app closes the table with blank spacer rows; a row without an order
    // input holds no performance.
    if (!orderInput) continue;

    const ident = identOf(orderInput);
    if (!ident) continue;

    const lockInput = qs(tr, 'input[name="lock' + ident + '"]');
    const songCell = cols.song >= 0 ? tr.children[cols.song] : null;
    const songLink = songCell ? qs(songCell, 'a[href]') : null;
    const last = tr.children[tr.children.length - 1];
    const remove = last ? qs(last, 'a[href]') : null;

    rows.push({
      key: ident,
      // The page's own number, kept so a changed arrangement can be told from
      // the one the app sent.
      order: Number(orderInput.value) || rows.length + 1,
      locked: /^1$/.test(String(lockInput ? lockInput.value : '')),
      song: {
        label: songLink ? textOf(songLink) : (songCell ? textOf(songCell) : ''),
        href: songLink ? songLink.getAttribute('href') : ''
      },
      className: words(tr, 'className'),
      instructor: words(tr, 'instructor'),
      day: words(tr, 'day'),
      start: words(tr, 'start'),
      length: words(tr, 'length'),
      notes: words(tr, 'notes'),
      deleteHref: remove ? remove.getAttribute('href') : '',
      orderSelector: 'input[name="perf' + ident + '"]',
      lockSelector: 'input[name="lock' + ident + '"]'
    });
  }

  const above = table.previousElementSibling;
  const title = above && TITLE.test(textOf(above)) ? textOf(above) : 'Performance Info';

  return {
    title,
    rows,
    actions: {
      add: actionIn(doc, ACTIONS.add),
      autoOrder: actionIn(doc, ACTIONS.autoOrder),
      checkConflicts: actionIn(doc, ACTIONS.checkConflicts)
    }
  };
}

// Write an arrangement back into the app's own inputs.
//
// Only the rows whose number changed are written, and every row is numbered from
// one, because that is what the page sent and what the app's widget writes. A row
// whose input has gone is reported rather than skipped: a partial order is not a
// save, the same rule `applyFields` keeps for a field.
export function applyOrder(doc, rows) {
  const applied = [];
  const missing = [];

  (rows || []).forEach((row, i) => {
    const input = row && row.orderSelector ? qs(doc, row.orderSelector) : null;
    if (!input) {
      if (row) missing.push(row.key);
      return;
    }
    const next = String(i + 1);
    if (String(input.value) === next) return;
    input.value = next;
    // The app's own listeners see an ordinary change, not a value that appeared.
    announcement(input, 'change');
    applied.push(row.key);
  });

  return { applied, missing };
}

// Flip one row's lock with the app's own toggle.
//
// All thirty-one rows carry the same handler (`StudioDir.ManageEvents.lock(this)`)
// so the handler cannot say which row was meant; the row's own hidden lock input
// can. The div beside it is the control, and clicking it is the app's own write —
// it sets the hidden value and swaps the icon. The fallback writes the input
// directly, which Save then persists the same way.
export function pressLock(doc, row) {
  const input = row && row.lockSelector ? qs(doc, row.lockSelector) : null;
  const cell = input && input.closest ? input.closest('td') : null;
  const toggle = cell ? qs(cell, '.link') : null;

  if (toggle) {
    toggle.click();
    return { pressed: true, locked: String(input.value) === '1', via: 'toggle' };
  }
  if (!input) return { pressed: false, reason: 'missing', locked: !!(row && row.locked) };

  input.value = String(input.value) === '1' ? '0' : '1';
  announcement(input, 'change');
  return { pressed: true, locked: String(input.value) === '1', via: 'input' };
}
