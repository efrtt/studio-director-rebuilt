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
// Radios are read as a group, as of the rebuild: this reader used to skip every
// radio input outright (`IGNORE_TYPES` held 'radio'), so a record form with a
// radio pair lost the setting silently while the settings reader read the same
// shape correctly. The choice is one value written to the set (see
// model/diff.js), never to whichever input came first.
//
// Nothing here submits anything. Values are written back into the app's own
// controls and its own Save link is clicked — see save.js.

import { qs, qsa, textOf } from './shell.js';
import { weekdayOf, optionsOf, valueOfSelect, selectorOf } from '../model/fields.js';

const FORM_SELECTOR = 'table.Form, table.FormEx';
const CONTROLS = 'input, select, textarea';
const IGNORE_IDS = new Set(['filter', 'searchidx', 'ResetPwdFlag', 'idPage', 'idMeth', 'idMethArgs']);
const IGNORE_TYPES = new Set(['hidden', 'file', 'submit', 'button', 'reset', 'image']);

// A control is addressed by id when it has one; otherwise by a unique name.
function controlOf(el, doc) {
  const tag = el.tagName.toLowerCase();
  const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
  if (IGNORE_TYPES.has(type)) return null;

  const id = el.getAttribute('id');
  const name = el.getAttribute('name') || '';
  if (id && IGNORE_IDS.has(id)) return null;

  const selector = selectorOf(el, doc);
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

// A radio pair inside one row is one field. Its label is the row's label, and
// its value is the chosen input's value; the group is addressed as a set.
function radioOf(name, radios, rowLabel) {
  const options = radios.map((el) => ({
    value: el.getAttribute('value') != null ? el.getAttribute('value') : '',
    label: textOf(el.closest('label')) || el.getAttribute('title') || '',
    checked: el.hasAttribute('checked')
  }));
  const chosen = options.find((o) => o.checked);
  if (!name) return null;

  return {
    key: 'radio:' + name,
    group: name,
    selector: '[name="' + name + '"]',
    id: radios[0].getAttribute('id') || '',
    name,
    type: 'radio',
    label: rowLabel || null,
    value: chosen ? chosen.value : '',
    checked: null,
    options,
    masked: false
  };
}

function fieldsIn(cell, doc, rowLabel) {
  const fields = [];
  const groups = new Map();

  for (const el of qsa(cell, CONTROLS)) {
    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;

    if (type === 'radio') {
      const name = el.getAttribute('name') || el.getAttribute('id') || '';
      if (!name) continue;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(el);
      continue;
    }

    const field = controlOf(el, doc);
    if (field) fields.push(field);
  }

  for (const [name, radios] of groups) {
    const field = radioOf(name, radios, rowLabel);
    if (field) fields.push(field);
  }

  return fields;
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

    const label = textOf(cells[0]);
    // The app ends a record editor with its own id in a row that has no label:
    // <tr><td></td><td><input id="item_id" value="1792595222235"></td></tr>.
    // Measured live on EditClass (`cident`) and ManageInventoryItems
    // (`item_id`). There is nothing to call it, and it is the record's key
    // rather than something a person fills in, so an unlabelled row is not a
    // field: it used to be offered as a bare number under the last one.
    // Nothing is lost by leaving it out — the input stays in the page, and a
    // save writes only the fields that changed.
    if (!label) continue;
    const fields = fieldsIn(cells[1], table.ownerDocument, label);
    if (!fields.length) continue;

    rows.push({ label, fields });
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

// Is this document a record editor already?
//
// The editor arrives server-rendered, so the page can be read where it stands
// and the copy fetched only when there is no form: one request less, and the
// tree that is read is the tree the edits are written into.
//
// Do not expect this to change a field count. EditFamily reports 19 fields
// because it has 19 editable controls: its three phone-type values arrive as
// `input[type=hidden]`, which this reader drops. The live page said so row by
// row; see the note in docs/rebuild-plan.md.
export function hasForm(doc) {
  return !!readForm(doc);
}
