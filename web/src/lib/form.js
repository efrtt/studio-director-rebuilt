// Record editor adapter.
//
// Confirmed from complete dumps of page=EditFamily and page=EditStudent: the
// editor is a `table.Form` beside the list panel, one row per field:
//
//   table.Form > tr > td     the label ("Guardian", "State", ...)
//                    > td     one or more controls (input / select / textarea)
//
// `NewClass` uses `table.FormEx` with the same row shape, so both table classes
// are accepted. The EditClass dump was cut off before the content root, so that
// page is unverified: it is only taken over if a table of this shape is actually
// present, and otherwise it is left to the app.
//
// Nothing here submits anything. Values are written back into the app's own
// controls and its own Save link is clicked — see save.js.

import { qs, qsa, textOf } from './shell.js';

const FORM_SELECTOR = 'table.Form, table.FormEx';
const CONTROLS = 'input, select, textarea';
const IGNORE_IDS = new Set(['filter', 'searchidx', 'ResetPwdFlag', 'idPage', 'idMeth', 'idMethArgs']);
const IGNORE_TYPES = new Set(['hidden', 'file', 'submit', 'button', 'reset', 'image', 'radio']);

// Weekday checkboxes are `#day__<bit>` with no label of their own; left alone
// every one of them reads "day". 1 = Sunday keeps the bit order the app uses
// (a Monday class has day__2 checked). It is a label only: the value is still
// written through the control's own id.
const WEEKDAY = { 1: 'Sun', 2: 'Mon', 4: 'Tue', 8: 'Wed', 16: 'Thu', 32: 'Fri', 64: 'Sat' };
// The class editor names them `day__2`; the reports prefix the same ids with
// their own subject (`classes_day__2`, `students_day__4`).
function weekdayOf(id) {
  const m = /(?:^|_)day__(\d+)$/.exec(id || '');
  return m ? WEEKDAY[Number(m[1])] || null : null;
}

function optionsOf(select) {
  const options = qsa(select, 'option').map((o) => ({
    value: o.getAttribute('value') != null ? o.getAttribute('value') : textOf(o),
    label: textOf(o),
    selected: o.hasAttribute('selected')
  }));
  return options;
}

function valueOfSelect(options) {
  const chosen = options.find((o) => o.selected);
  return (chosen || options[0] || { value: '' }).value;
}

// A control is addressed by id when it has one. Some fields in the dumps carry
// only a name (`select name="family"`), so a name is used when it is unique on
// the page — never when it could be one of several.
function controlOf(el, doc) {
  const tag = el.tagName.toLowerCase();
  const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
  if (IGNORE_TYPES.has(type)) return null;

  const id = el.getAttribute('id');
  const name = el.getAttribute('name') || '';
  if (id && IGNORE_IDS.has(id)) return null;

  let selector = null;
  if (id) selector = '#' + id;
  else if (name && name !== '-' && qsa(doc, '[name="' + name + '"]').length === 1) {
    selector = '[name="' + name + '"]';
  }
  if (!selector) return null;

  const options = tag === 'select' ? optionsOf(el) : null;
  // An empty select cannot be edited (the class page's date picker is filled in
  // by the app's own JS), so it is not offered as a field.
  if (options && options.length === 0) return null;

  return {
    key: id || 'name:' + name,
    selector,
    id,
    name,
    type,
    // What the rebuilt editor prints for this control.
    label: weekdayOf(id),
    value: type === 'checkbox'
      ? null
      : tag === 'textarea'
        ? textOf(el)
        : options
          ? valueOfSelect(options)
          : (el.getAttribute('value') || ''),
    checked: type === 'checkbox' ? el.hasAttribute('checked') : null,
    options,
    // The app masks phone inputs with JS; it stays masked, we just carry the text.
    masked: /(^|\s)masked(\s|$)/.test(el.getAttribute('class') || '')
  };
}

function rowsOf(table) {
  const rows = [];
  for (const tr of qsa(table, 'tr')) {
    // Only this table's own rows: a field can contain a nested table (the
    // weekday checkboxes live in one), and its rows would otherwise be read a
    // second time as fields of their own, with no label.
    if (tr.closest && tr.closest('table') !== table) continue;
    const cells = Array.from(tr.children || []).filter((c) => c.tagName === 'TD');
    if (cells.length < 2) continue;

    const fields = qsa(cells[1], CONTROLS).map((el) => controlOf(el, table.ownerDocument)).filter(Boolean);
    if (!fields.length) continue;

    rows.push({ label: textOf(cells[0]), fields });
  }
  return rows;
}

// The editor is the form-shaped table with the most fields on the page. A page
// with two or three stray controls is not an editor, so it yields nothing and
// the caller leaves the app alone rather than inventing a form.
export function readForm(doc) {
  let best = null;

  for (const table of qsa(doc, FORM_SELECTOR)) {
    const rows = rowsOf(table);
    const fields = rows.reduce((all, row) => all.concat(row.fields), []);
    // Four controls minimum: a list page's editor stub has three, a real record
    // editor has fourteen and up.
    if (fields.length < 4) continue;
    if (!best || fields.length > best.fields.length) best = { rows, fields };
  }

  if (!best) return null;

  return {
    kind: 'form',
    title: textOf(qs(doc, '.formTitle')) || 'Edit',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    rows: best.rows,
    fields: best.fields
  };
}
