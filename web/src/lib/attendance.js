// Attendance: the one screen in the app where every cell is a control.
//
// Measured live (2026-11-04) on `page=Attendance&cident=…`: one `table.SimpleSD`
// whose first two columns name the student and whose remaining columns are the
// dates of this view. Every date cell holds
//
//   <input type="checkbox" id="{sid}_{YYYY-MM-DD}_0"
//          onclick="StudioDir.Attendance.onChange(this)" checked>
//   <span id="…_reasoninfo" style="display:none">Reason:<br>
//     <select name="…_reason">…</select><br>Studio notes:<br>
//     <textarea name="…_notes"></textarea>
//     <input type="hidden" name="…_absent" value="0"></span>
//
// and the date's own header carries the page's Cancel Class control:
//
//   <th id="{YYYY-MM-DD}">Mon, Nov 2, 2026
//     <div style="padding-top:4px">
//       <input type="hidden" name="args…" value="2026_002d11_002d02">
//       <a href="#" onclick="StudioDir.onCallMethodSubmit('Attendance',
//          'cancelClass','args…');;return false;">Cancel Class</a></div></th>
//
// A grid of controls is not a table of records, which is why the sheet reader
// refuses it (see lib/sheet.js). Nothing here is constructed and nothing is
// submitted by this code: a tick presses the app's own checkbox so that its own
// `onChange` reveals the reason and sets `_absent`, the reason and the notes are
// written into the app's own select and textarea, and Save is the page's own
// `#save`. The page stays the record; this is a reading and writing surface for
// it, dated by `--page-gutter` like every other view.

import { qs, qsa, textOf, titleOf, breadcrumbOf } from './shell.js';
import { pageSave } from './save.js';
import { pageRegions } from '../model/regions.js';

// The app's own handler is the marker: a printed roster's tick boxes carry none,
// and it must keep reading as a sheet.
const BOX = 'input[type="checkbox"][onclick*="Attendance.onChange"]';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The header and the body disagree about the element (TH against TD), so cells
// are counted by position rather than by tag: the fifth cell of the header and
// the fifth cell of a row are the same date.
function rowCells(tr) {
  return Array.from(tr.children || []).filter((cell) => cell.tagName === 'TD' || cell.tagName === 'TH');
}

function optionValue(option) {
  const value = option.getAttribute('value');
  return value != null ? value : textOf(option);
}

function chosenValue(select, options) {
  const chosen = qsa(select, 'option').find((option) => option.hasAttribute('selected'));
  if (chosen) return optionValue(chosen);
  // No attribute: the browser has already resolved the default, and reading the
  // property is what the live page needs (an untouched select shows option one).
  const live = select.value;
  if (typeof live === 'string' && live !== '') return live;
  return options.length ? options[0].value : '';
}

function readCell(cell) {
  const box = qs(cell, BOX);
  if (!box) return null;

  // A make-up, drop-in or trial registration is a superscript beside the tick:
  // the page marks the cell and prints what the number means in its key.
  const sup = qs(cell, 'sup');
  const select = qs(cell, 'select');
  const area = qs(cell, 'textarea');
  const options = select
    ? qsa(select, 'option').map((option) => ({ value: optionValue(option), label: textOf(option) }))
    : [];
  const value = select ? chosenValue(select, options) : '';
  const named = options.find((option) => String(option.value) === String(value));

  return {
    // The app's own checkbox, by id: pressing it is what runs its onChange.
    boxId: box.getAttribute('id') || '',
    present: box.checked !== undefined ? !!box.checked : box.hasAttribute('checked'),
    // Resolved against the page's own key once every cell is read.
    mark: sup ? { n: textOf(sup).trim(), label: '', title: '' } : null,
    options,
    reason: {
      name: select ? select.getAttribute('name') || '' : '',
      value: String(value),
      label: named ? named.label : ''
    },
    notes: {
      name: area ? area.getAttribute('name') || '' : '',
      value: area ? String(area.value != null ? area.value : textOf(area)) : ''
    }
  };
}

// The key to those superscripts, printed in the page's own notes cell: a
// numbered line per registration, worded by the app ("Make-up/Trial/Drop-in
// Student: Trial"). Nothing is invented here — the number is matched to the
// app's line and the line is shown.
const LEGEND = /^make-?up\s*\/\s*trial\s*\/\s*drop-?in\s*student\s*:\s*(.+)$/i;

function readLegend(doc) {
  const area = qs(doc, 'textarea[name="att_notes"]');
  const cell = area ? area.closest('td') : null;
  const key = {};
  if (!cell) return key;

  for (const input of qsa(cell, 'input[type="hidden"][name^="args"]')) {
    let lead = '';
    for (let node = input.previousSibling; node && !lead; node = node.previousSibling) {
      if (node.nodeType === 3) lead = String(node.nodeValue || '').trim();
    }
    const anchor = input.nextElementSibling;
    const line = anchor ? textOf(anchor).replace(/\s+/g, ' ').trim() : '';
    const named = LEGEND.exec(line);
    const number = lead.replace(/[^0-9]/g, '');
    if (!named || !number) continue;
    key[number] = { label: named[1].trim(), title: line };
  }
  return key;
}

// The page's own Prev / Next, which move this view through the class's dates.
const MOVES = /["']Attendance["']\s*,\s*["'](prev|next)["']/i;

export function readAttendance(doc) {
  // Which table is the register is the page-wide judgement's: the one inside the
  // content root that carries the app's own tick box. It used to be the first
  // `table` in the whole document — a scrape around the classifier that could
  // pick a table outside the screen (a layout wrapper, a rail panel).
  const found = pageRegions(doc).tables
    .filter((entry) => entry.kind !== 'chrome')
    .find((entry) => qs(entry.table, BOX));
  const table = found ? found.table : null;
  if (!table) return null;

  const head = qsa(table, 'tr').find((tr) => qs(tr, 'th'));
  if (!head) return null;

  const seen = new Set();
  const dates = [];
  rowCells(head).forEach((cell, index) => {
    const key = (cell.getAttribute('id') || '').trim();
    if (!ISO_DATE.test(key) || seen.has(key)) return;
    seen.add(key);
    const cancel = qsa(cell, 'a').find((anchor) => /cancelclass/i.test(anchor.getAttribute('onclick') || ''));
    dates.push({
      key,
      index,
      // The header's own words, without the control inside it.
      label: textOf(cell).replace(/cancel\s*class/i, '').trim() || key,
      // `exact` says this action was read from one element of this date, so its
      // own handler is what names it. (An action deduped out of five identical
      // labels cannot say which of the five it meant, and is never pressed.)
      cancel: cancel
        ? { label: textOf(cancel) || 'Cancel Class', onclick: cancel.getAttribute('onclick') || '', exact: true }
        : null
    });
  });
  if (!dates.length) return null;

  const firstDate = Math.min(...dates.map((date) => date.index));
  const students = [];

  for (const tr of qsa(table, 'tr')) {
    if (tr === head || qs(tr, 'th')) continue;
    const cells = rowCells(tr);
    if (!qs(tr, BOX)) continue;

    // Everything left of the first date column names the student: the app puts
    // the first name in a link to the student's record and the last name beside
    // it in a plain cell.
    const leading = cells.slice(0, firstDate);
    const name = leading.map(textOf).filter(Boolean).join(' ');
    if (!name) continue;
    const link = leading.map((cell) => (cell ? qs(cell, 'a[href]') : null)).find(Boolean);

    const byDate = {};
    for (const date of dates) {
      const cell = cells[date.index] || null;
      byDate[date.key] = cell ? readCell(cell) : null;
    }

    students.push({
      name,
      href: link ? link.getAttribute('href') || '' : '',
      cells: byDate
    });
  }

  // Say what the superscripts mean, from the page's own key.
  const legend = readLegend(doc);
  for (const student of students) {
    for (const date of dates) {
      const cell = student.cells[date.key];
      const entry = cell && cell.mark ? legend[cell.mark.n] : null;
      if (!entry) continue;
      cell.mark.label = entry.label;
      cell.mark.title = entry.title;
    }
  }

  if (!students.length) return null;

  const notesArea = qs(doc, 'textarea[name="att_notes"]');
  const notes = notesArea
    ? { name: 'att_notes', value: String(notesArea.value != null ? notesArea.value : textOf(notesArea)) }
    : null;

  // The notes sit in a cell that also carries the page's own ways of adding a
  // make-up or a drop-in to this class. Those are the app's controls, so they
  // stay beside the notes, where the app puts them.
  const notesCell = notesArea ? notesArea.closest('td') : null;
  const actions = notesCell
    ? qsa(notesCell, 'a[onclick]')
      .map((anchor) => ({ label: textOf(anchor), onclick: anchor.getAttribute('onclick') || '', exact: true }))
      // The numbered key to the superscripts lives in this cell too, and it is
      // not one of this screen's controls.
      .filter((action) => action.label && !LEGEND.test(action.label))
    : [];

  const nav = [];
  for (const anchor of qsa(doc, 'a[onclick]')) {
    const onclick = anchor.getAttribute('onclick') || '';
    if (!MOVES.test(onclick)) continue;
    nav.push({ label: textOf(anchor), onclick, exact: true });
  }

  const saveLink = pageSave(doc);
  const save = saveLink
    ? { id: 'save', label: textOf(saveLink) || 'Save', onclick: saveLink.getAttribute('onclick') || '' }
    : null;

  const breadcrumb = breadcrumbOf(doc);

  return {
    kind: 'attendance',
    title: titleOf(doc, 'div') || 'Attendance',
    breadcrumb,
    // The class this attendance belongs to, named the way the page names it.
    className: breadcrumb.length ? breadcrumb[breadcrumb.length - 1] : '',
    dates: dates.map(({ key, label, cancel }) => ({ key, label, cancel })),
    students,
    notes,
    actions,
    nav,
    save
  };
}

// ---------------------------------------------------------------------------
// Writing: the app's own controls, never a constructed request.
// ---------------------------------------------------------------------------

function announce(element, type) {
  try {
    const view = element.ownerDocument && element.ownerDocument.defaultView;
    const Event = (view && view.Event) || globalThis.Event;
    if (Event) element.dispatchEvent(new Event(type, { bubbles: true }));
  } catch (e) {
    // A document without events still has the value; the app's masks are the
    // only thing that misses this, and a form POST reads the control itself.
  }
}

// A tick box's state, read the way the page stores it. A live browser keeps the
// `checked` property; a parsed copy (and the tests' DOM) only has the attribute,
// and reading one where only the other exists made an untouched box look changed.
function isChecked(box) {
  return box.checked !== undefined ? !!box.checked : box.hasAttribute('checked');
}

function setSelect(select, wanted) {
  // Validate before touching anything: a refused reason must leave the app's
  // own choice exactly where it was, not clear it and then refuse.
  const options = qsa(select, 'option');
  const chosen = options.filter((option) => String(optionValue(option)) === wanted);
  if (!chosen.length) return false;
  for (const option of options) {
    if (chosen.includes(option)) option.setAttribute('selected', '');
    else option.removeAttribute('selected');
  }
  // The property is what a browser submits; the attribute above is what a parsed
  // copy shows, and a parsed copy may expose `value` as read-only. Both are
  // written so the choice survives either reading.
  try { select.value = wanted; } catch (e) { /* the attribute is the answer */ }
  return true;
}

function setText(area, value) {
  try { area.value = value; } catch (e) { /* see setSelect */ }
  if (area.textContent !== value) area.textContent = value;
}

function named(doc, name) {
  if (!name) return null;
  const hits = qsa(doc, '[name="' + String(name).replace(/"/g, '\\"') + '"]');
  return hits.length === 1 ? hits[0] : null;
}

// A tick, pressed on the app's own checkbox: its `onChange` reveals the reason
// block and sets `_absent`, exactly as it does for a person.
export function markAttendanceInApp(doc, boxId, present) {
  const box = boxId ? doc.getElementById(boxId) : null;
  if (!box) return { ok: false, reason: 'missing' };
  if (isChecked(box) === !!present) return { ok: true, unchanged: true };
  // The press, not an assignment: the app's `onChange` is what reveals the
  // reason block and sets `_absent`.
  if (typeof box.click === 'function') box.click();
  else box.checked = !!present;
  if (isChecked(box) !== !!present) return { ok: false, reason: 'refused' };
  return { ok: true };
}

// The reason and the studio notes, written where the app keeps them.
export function writeAbsenceInApp(doc, cell, reason, notes) {
  if (!cell) return { ok: false, reason: 'no-cell' };
  const select = named(doc, cell.reason && cell.reason.name);
  const area = named(doc, cell.notes && cell.notes.name);
  if (!select || !area) return { ok: false, reason: 'missing' };

  const wanted = String(reason == null ? '' : reason);
  // A reason the app does not offer is refused, never invented.
  if (!setSelect(select, wanted)) return { ok: false, reason: 'no-option' };
  announce(select, 'input');
  announce(select, 'change');
  setText(area, String(notes == null ? '' : notes));
  announce(area, 'input');
  announce(area, 'change');
  return { ok: true };
}

// The class's own attendance notes: one field for the whole date range.
export function writeNotesInApp(doc, field, value) {
  const area = named(doc, field && field.name);
  if (!area) return { ok: false, reason: 'missing' };
  setText(area, String(value == null ? '' : value));
  announce(area, 'input');
  announce(area, 'change');
  return { ok: true };
}

// The page's own Save: a full-page submit the app builds.
export function pressAttendanceSave(doc) {
  const save = pageSave(doc);
  if (!save || typeof save.click !== 'function') return { submitted: false, reason: 'no-save-link' };
  save.click();
  return { submitted: true };
}
