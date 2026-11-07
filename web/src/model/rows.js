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
// Each row is classified on its own evidence: a row with a label and controls is
// a field row; a row with no label is the record's key (not a field); a row this
// reader cannot address is still on the page, so its controls are reported as
// passed rather than lost. `model/regions.js` owns that classification (and the
// question of which tables are the editor); this module turns the field rows it
// finds into fields.
//
// Nothing here decides whether a page is an editor — that is `pageSave` plus the
// rows found here. Nothing here ranks tables by size, and there is no selector
// list here to keep in step with the app: the regions module knows them.

import { qsa, textOf } from '../lib/shell.js';
import { controlsIn, CONTROLS } from './controls.js';
import { rowLabel } from './labels.js';
import { valueOfControl } from './fields.js';

export { CONTROLS };

// Which tables are the editor, and what each of their rows is, moved to
// `model/regions.js`: this module reads one table row by row, and the region
// question (declared, structural, or no table at all) is answered there.

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

// What a row is called, and what its label cell carries besides the name.
//
// The name is the row's first cell of plain text (`model/labels.js`); a row whose
// label cell is itself a control — a phone's type select — is named by the choice
// it holds, and a row that prints a button there is named without it: "Email Reset
// Password" is the email field, with the button beside it. Both readers below use
// this, so a row cannot be named one way by the editor and another by the totals.
function nameOfRow(tr, table) {
  const cells = rowCells(tr, table);
  const extra = rowExtras(cells[0], tr.ownerDocument);
  // A label cell that holds a control has no name of its own: a select's text is
  // the whole option list, and a hidden input beside its link is plumbing. Such a
  // row is named by the choice it holds instead.
  const hasControl = !!(cells[0] && cells[0].querySelector && cells[0].querySelector('select, input, textarea'));
  let label = hasControl ? '' : rowLabel(tr);
  if (extra.action && label) {
    label = label.replace(extra.action.label, '').replace(/[-:\s]+$/, '').trim() || label;
  }
  if (!label) label = extra.label;
  return { label, extra };
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
    rows.push({ label: nameOfRow(tr, table).label, cell: cells[1] });
  }
  return rows;
}

// A row that prints a label and a value: a name cell and the cell its value sits
// in. The payment screen's totals read their rows this way, and so does the
// sheet's "this is a label/value block, not a record grid" test — one question,
// asked from the row's own cells.
export function isValueRow(cells) {
  return !!(cells && cells.length >= 2);
}

// Presence on a table that has already been read. These are the three things a
// reader actually wants to know before it draws or skips one: does it print a
// heading row, does it print rows, and is there nothing at all in it. Every
// reader that used to test `headings.length`/`rows.length` itself asks these.
export function hasHeadings(read) {
  return !!(read && read.headings && read.headings.length);
}

export function hasRows(read) {
  return !!(read && read.rows && read.rows.length);
}

export function isEmptyTable(read) {
  return !hasHeadings(read) && !hasRows(read);
}

// A table with no heading row whose rows each print at most a label and its
// value: how a settings page and a payment's totals lay a form out. It is not a
// list of records, which is the sheet reader's question about it.
export function isValueTable(read) {
  if (!read || hasHeadings(read)) return false;
  const rows = read.rows || [];
  return rows.length > 0 && rows.every((row) => isValueRow(row));
}

// A row can name itself with a control, and can carry a button of its own.
//
// A phone row prints its type in the label cell: a select whose name ends in
// `_label`, or — after the app's own JS has run — a hidden input of that name
// beside a "Select Phone Type" link. The email row prints its Reset Password
// button there. Neither is a field of the value cell, so neither was read, and
// the phone type arrived as the words of a link the reader could not type into.
const LABEL_CONTROL = 'select[name$="_label"], input[name$="_label"]';

// The app's ten phone types, in its own order, with the codes it submits —
// captured from the live select in `editor-family.html`. Once the app's own JS has
// converted a row, the select is gone (`StudioDir.DynaLoad.editPhoneLabel`
// replaces it) and only the hidden value is left, so the list cannot be read from
// the page at all. A type you can read but not choose is the gap this closes.
const PHONE_TYPES = [
  { value: '0', label: 'Select Phone Type' },
  { value: '4', label: 'Home Phone' },
  { value: '6', label: 'Mom Cell' },
  { value: '7', label: 'Phone 1' },
  { value: '8', label: 'Dad Cell' },
  { value: '9', label: 'Phone 2' },
  { value: '2', label: 'Student Cell' },
  { value: '1', label: 'Nanny/Babysitter' },
  { value: '3', label: 'Phone 3' },
  { value: '5', label: 'Work Phone' }
];

// The option list a phone type offers: the row's own select when it still has
// one, the page's when a sibling row does, and the app's vocabulary otherwise.
function labelOptions(el, doc) {
  const own = el.tagName === 'SELECT' ? qsa(el, 'option') : [];
  const source = own.length ? own : qsa(doc, 'select[name$="_label"] option');
  if (!source.length) return PHONE_TYPES.map((option) => ({ ...option }));
  return source.map((option) => ({
    value: option.getAttribute('value') != null ? option.getAttribute('value') : textOf(option),
    label: textOf(option)
  }));
}

// What a row says about itself outside its value cell: the choice that names it,
// and the button it offers. `el` is the choice control, so coverage can count it
// as read rather than reporting it as a control nobody looked at.
export function rowExtras(cell, doc) {
  const out = { field: null, label: '', action: null, el: null };
  if (!cell || !cell.querySelector) return out;

  const type = cell.querySelector(LABEL_CONTROL);
  if (type) {
    const name = type.getAttribute('name') || '';
    // Read the control the way every other reader does: a select's value is its
    // chosen option (its first when none is marked), a converted row's value is
    // the hidden input's own.
    const read = type.tagName === 'SELECT' ? valueOfControl(type) : null;
    const options = read ? read.options : labelOptions(type, doc);
    const value = read ? read.value : (type.getAttribute('value') || '');
    const chosen = options.find((option) => String(option.value) === String(value));
    out.el = type;
    out.label = chosen ? chosen.label : (options[0] ? options[0].label : '');
    if (name && options.length) {
      const id = type.getAttribute('id');
      out.field = {
        // The same address rule as `model/controls.js`: an id when the app gives
        // one, the name otherwise.
        key: id || 'name:' + name,
        selector: '[name="' + name + '"]',
        id: id || null,
        name,
        type: 'select',
        label: null,
        value,
        checked: null,
        options,
        masked: false,
        // A type control is narrow: it sits on the line with the value it names.
        compact: true
      };
    }
  }

  // The row's own button, by the app's wording. It is pressed where it stands
  // (`model/press.js`), so the handler is what identifies it: this page's anchor
  // lives inside the form table, where a label match deliberately refuses to look.
  const button = Array.from(cell.querySelectorAll('a, button, span[onclick], div[onclick]'))
    .find((el) => /^reset\s*password$/i.test(textOf(el)));
  if (button) {
    out.action = {
      label: textOf(button),
      id: button.getAttribute('id') || '',
      href: button.getAttribute('href') || '',
      js: true,
      exact: true,
      onclick: (button.getAttribute('onclick') || '').trim()
    };
  }

  return out;
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
    const { label, extra } = nameOfRow(tr, table);
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
      if (extra.el) passed.push(extra.el);
      continue;
    }
    const found = fieldsIn(cells[1], table.ownerDocument, label);
    // The type control prints before the value it names, in the app's own order.
    const fields = extra.field ? [extra.field, ...found.fields] : found.fields;
    if (!fields.length) {
      passed.push(...found.passed);
      if (extra.el) passed.push(extra.el);
      continue;
    }

    rows.push({ label, fields, ...(extra.action ? { action: extra.action } : {}) });
    shown.push(...found.shown);
    if (extra.el) shown.push(extra.el);
    passed.push(...found.passed);
  }
  return { rows, shown, passed };
}

export const fieldsOfRows = (rows) => rows.reduce((all, row) => all.concat(row.fields), []);
