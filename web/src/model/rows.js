// A form table, read row by row.
//
// This is the one judgement every form-shaped reader shares. It used to live in
// `lib/form.js` with a second, flatter copy in `lib/settings.js`, and the two
// disagreed about addressing: settings trusted any id, the editor required the
// id to be unique. The editor's rule is the correct one — an id shared with a
// button-bar anchor (`<a id="email">` beside `input#email>` on EditFamily) made
// `querySelector('#email')` return the anchor, so a save wrote the value onto an
// anchor and reported success — so there is one rule now, in `model/fields.js`,
// and one row reader here.
//
// What a row is, in the app's own markup:
//
//   table.Form > tr > td     the label ("Guardian", "State", ...)
//                    > td     one or more controls (input / select / textarea)
//
// `NewClass` uses `table.FormEx` with the same row shape, so both table classes
// are accepted. Each row is classified on its own evidence: a row with a label
// and at least one control this reader can address is a field row; a row with no
// label is the record's key (not a field); a row this reader cannot address is
// still on the page, so its controls are reported as passed rather than lost.
//
// Nothing here decides whether a page is an editor — that is `pageSave` plus the
// rows found here. Nothing here ranks tables by size.

import { qsa, textOf } from '../lib/shell.js';
import { controlsIn, CONTROLS } from './controls.js';
import { rowLabel } from './labels.js';
import { isHidden } from './root.js';

export const FORM_SELECTOR = 'table.Form, table.FormEx';
export { CONTROLS };

// Every form table the page is showing inside its content root, in document
// order. A table the page itself calls hidden (`table-hidden`, `hidden`) is
// storage, not a field row — see `isHidden` for why `display:none` is not a
// signal here.
//
// The query runs from the document and is then narrowed to the content root.
// Asking the root instead reads better and is what this did first, but a
// `<body>` is not always the node that holds its children (a parsed fragment has
// a detached one), and an editor there came back empty. When the root *is* the
// body the whole document is the screen, so there is nothing to narrow.
export function formTablesIn(doc, root) {
  return qsa(doc, FORM_SELECTOR)
    .filter((table) => (root === doc.body || !root.contains ? true : root.contains(table)))
    .filter((table) => !isHidden(table));
}

// This editor prints one select bound to one value, so a multi-choice select
// (which `model/controls.js` reads as a set, for the settings card that draws it)
// keeps the conventional reading here. No record capture carries one.
function editorFieldOf(field) {
  if (!field || field.type !== 'multiselect') return field;
  return {
    ...field,
    type: 'select',
    value: field.value[0] || (field.options[0] || {}).value || ''
  };
}

// A radio pair inside one row is one field. Its label is the row's label, and
// its value is the chosen input's value; the group is addressed as a set.
export function radioOf(name, radios, rowLabel) {
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

// Returns the fields of the cell, plus the two lists coverage needs: the controls
// that became fields, and the ones this reader knowingly walked past (a hidden
// key, `name="-"`, an empty select the app fills later). A control in neither
// list is one nobody looked at, which is what `unread` means.
export function fieldsIn(cell, doc, rowLabel) {
  const fields = [];
  const shown = [];
  const passed = [];
  const groups = new Map();

  // One walk, shared with the settings card: it is handed this cell as the
  // container and returns every control's reading (or null where the page does
  // not address one). The grouping below is the editor's own, because here a
  // radio pair belongs to the row it is printed in.
  const found = controlsIn(cell, doc);
  passed.push(...found.ignored);

  for (const { el, field } of found.entries) {
    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;

    if (type === 'radio') {
      const name = el.getAttribute('name') || el.getAttribute('id') || '';
      if (!name) {
        passed.push(el);
        continue;
      }
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(el);
      continue;
    }

    if (field) {
      fields.push(editorFieldOf(field));
      shown.push(el);
    } else {
      passed.push(el);
    }
  }

  for (const [name, radios] of groups) {
    const field = radioOf(name, radios, rowLabel);
    if (field) {
      fields.push(field);
      shown.push(...radios);
    } else {
      passed.push(...radios);
    }
  }

  return { fields, shown, passed };
}

// The cells of one row *of this table*: a field can contain a nested table (the
// weekday checkboxes live in one), and its rows would otherwise be read a second
// time as fields of their own, with no label. Every reader that splits a row
// asks this, so it is asked once — the record editor's rows, a payment's base
// form and its split blocks, and the totals beside them.
export function rowCells(tr, table) {
  if (!tr) return [];
  if (tr.closest && table && tr.closest('table') !== table) return [];
  return Array.from(tr.children || []).filter((c) => c.tagName === 'TD');
}

// Every two-cell row of a table, with the cell that names it and the cell that
// holds its content: the plain shape a screen prints with no heading row. A
// payment's base form is the shape outside an editor — "Family | the family",
// "Amount | an input" — so it reads its rows here rather than keeping a second
// copy of the split.
export function labelledRows(table) {
  const rows = [];
  if (!table) return rows;
  for (const tr of qsa(table, 'tr')) {
    const cells = rowCells(tr, table);
    if (cells.length < 2) continue;
    rows.push({ label: textOf(cells[0]).slice(0, 120), cell: cells[1] });
  }
  return rows;
}

export function rowsOf(table) {
  const rows = [];
  const shown = [];
  const passed = [];
  for (const tr of qsa(table, 'tr')) {
    if (tr.closest && tr.closest('table') !== table) continue;
    const cells = rowCells(tr, table);
    if (cells.length < 2) {
      // A caption or a spacer row. Anything typed into it is still on the page,
      // so it counts as passed over rather than lost.
      passed.push(...qsa(tr, CONTROLS));
      continue;
    }

    // What names this row is `model/labels.js`'s step 3, asked of the row: the
    // first cell that is text and holds no control. It is the same rule the
    // settings card uses for a control; here it names the whole row, so a row
    // whose controls sit in a nested table (the weekday boxes) still gets named.
    const label = rowLabel(tr);
    // The app ends a record editor with its own id in a row that has no label:
    // <tr><td></td><td><input id="item_id" value="1792595222235"></td></tr>.
    // Measured live on EditClass (`cident`) and ManageInventoryItems
    // (`item_id`). There is nothing to call it, and it is the record's key
    // rather than something a person fills in, so an unlabelled row is not a
    // field: it used to be offered as a bare number under the last one.
    // Nothing is lost by leaving it out — the input stays in the page, and a
    // save writes only the fields that changed.
    if (!label) {
      passed.push(...qsa(cells[1], CONTROLS));
      continue;
    }
    const found = fieldsIn(cells[1], table.ownerDocument, label);
    if (!found.fields.length) {
      passed.push(...found.passed);
      continue;
    }

    rows.push({ label, fields: found.fields });
    shown.push(...found.shown);
    passed.push(...found.passed);
  }
  return { rows, shown, passed };
}

export const fieldsOfRows = (rows) => rows.reduce((all, row) => all.concat(row.fields), []);
