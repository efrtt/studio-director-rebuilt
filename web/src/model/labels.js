// What a control is called, in one place.
//
// Two readers had a ladder for this and they disagreed: `lib/settings.js` grew
// the full one (label → cell → title → block → humanised name) because toggle
// pages print their controls in plain divs, and `lib/form.js` only ever looked at
// the row's first cell. They were answering the same question about the same app,
// so it is answered once here — and the editor's row label is the same "the cell
// before it" step, applied to the row's own layout rather than to a group.
//
// The order is the order a person reading the page uses:
//
//   1. `<label for="…">`                       the app's own label
//   2. a `<label>` wrapping the control
//   3. the cell before it in a table row       label column, control column
//   4. `aria-label` / `title`
//   5. the block before it                     `<div>Name</div><input>`
//   6. its own id or name, humanised           `familyMax` → "Family max"
//
// Step 6 is a fallback, and the model says so with `source: 'name'` so a view can
// mark a guess rather than pass it off as the app's wording.
//
// `labelOfBlock` is the same ladder without steps 1–2, for a block that *contains*
// several controls (a radio group, a checkbox group): its label is the block's,
// never one choice's own words.
//
// `rowLabel` is step 3 as a row question: which cell of this row names it. A row
// with no such cell is the record's own key (`<td></td><td><input id="item_id">`),
// which is why it returns null rather than guessing — that is the difference
// between "this row names the field" and "the field's name is all we have".

import { qsa, textOf } from '../lib/shell.js';
import { humanise } from './fields.js';
import { FURNITURE } from './appdom.js';

const CONTROL = 'input, select, textarea, button';

// A control is not a label for the control after it. Two date pickers side by
// side with nothing between them would otherwise take turns naming each other —
// the second one's "label" came back as the first one's selected option.
function isControl(el) {
  return !!(el && el.matches && el.matches(CONTROL));
}

// The words in a cell that is meant to name something: it has text, it is not
// itself a control, and it does not hold one.
function namingText(el) {
  if (!el) return '';
  if (isControl(el) || qsa(el, CONTROL).length) return '';
  return textOf(el).slice(0, 120);
}

function cellLabel(el) {
  const cell = el.closest && el.closest('td');
  let prev = cell && cell.previousElementSibling;
  while (prev) {
    const text = namingText(prev);
    if (text) return text;
    prev = prev.previousElementSibling;
  }
  return '';
}

function blockBefore(el) {
  let before = el.previousElementSibling;
  while (before) {
    if (isControl(before) || (before.matches && before.matches(FURNITURE))) {
      before = before.previousElementSibling;
      continue;
    }
    const text = namingText(before);
    if (text) return text;
    before = before.previousElementSibling;
  }
  return '';
}

// Step 5, generalised to a row printed as divs: the label is the first text in
// the control's own field row, before the control. Climbing stops at the first
// ancestor that holds more than one control group — that ancestor is the form,
// not a row — so a paragraph higher up the page cannot name a field, and a row
// that names nothing still falls through to the guessed name.
//
// This is what makes the no-table editor (`.formRow > .formLabel +
// .formInput`) read its labels as the page prints them, rather than as the
// control's id: `guardian` → "Guardian" was the old reading of "Guardian
// Name(s)". A control's group is its name, or its id, or itself.
function groupKey(el, index) {
  return el.getAttribute('name') || el.getAttribute('id') || '#' + index;
}

export function leadingLabel(el, boundary) {
  for (let node = el.parentElement; node && node !== boundary && node.nodeType === 1; node = node.parentElement) {
    const controls = qsa(node, CONTROL);
    const groups = new Set(controls.map(groupKey));
    if (groups.size > 1) return null;
    for (const child of Array.from(node.children || [])) {
      if (child === el || (child.contains && child.contains(el))) break;
      if (child.matches && child.matches(FURNITURE)) continue;
      const text = namingText(child);
      if (text) return { label: text, source: 'row' };
    }
  }
  return null;
}

// Steps 3–6 of the ladder, for a control or for a block that holds several.
// `fallback: false` stops before the guessed name, which is what the record
// editor asks: a row the page does not name is the record's key, not a field.
export function labelOfBlock(el, doc, opts = {}) {
  const fallback = opts.fallback !== false;

  const cell = cellLabel(el);
  if (cell) return { label: cell, source: 'cell' };

  const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
  if (aria) return { label: aria.slice(0, 120), source: 'title' };

  const block = blockBefore(el);
  if (block) return { label: block, source: 'block' };

  if (!fallback) return null;

  const name = el.getAttribute('name') || '';
  return { label: humanise(el.getAttribute('id') || name) || 'Setting', source: 'name' };
}

// The whole ladder. Returns `{ label, source }`; `source: 'name'` is the guess.
export function labelOfControl(el, doc, opts = {}) {
  const id = el.getAttribute('id') || '';

  if (id) {
    const text = textOf(doc.querySelector('label[for="' + id + '"]'));
    if (text) return { label: text, source: 'label' };
  }

  // A label that wraps the control ("<label><input> Yes</label>").
  const wrap = textOf(el.closest && el.closest('label'));
  if (wrap) return { label: wrap.slice(0, 120), source: 'label' };

  return labelOfBlock(el, doc, opts);
}

// What names this row, from the row's own cells: the first one with text. This is
// step 3 of the ladder, asked of a `<tr>` so a row whose controls sit in a nested
// table (the weekday boxes) is still named by the cell beside them.
//
// Unlike the cell rule above, a cell that also *holds* controls still names the
// row: the family editor prints each phone's three type-selects inside the label
// cell ("Select Phone Type" beside "Home Phone"), and refusing control-holding
// cells dropped three rows of a real editor. The stricter rule is for a control
// looking for the cell that names *it*, where a neighbouring picker must not
// answer.
export function rowLabel(tr) {
  const cells = Array.from(tr.children || []).filter((c) => c.tagName === 'TD' || c.tagName === 'TH');
  for (const cell of cells) {
    const text = textOf(cell).slice(0, 120);
    if (text) return text;
  }
  return '';
}
