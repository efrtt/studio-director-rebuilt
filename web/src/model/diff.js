// The diff and the applier, once.
//
// `save.js`, `report.js`, `task.js` and `settings.js` each had their own copy of
// "compare the rendered values to the page's, collect what changed", and their
// own call to an applier that reported only what it had written. The bug that
// allowed: `saveInApp` answered `{ submitted: true }` whenever the app's Save
// existed, even when a change had not been applied — a selector that missed the
// live DOM produced "saved" for an edit that was never written.
//
// So `applyFields` returns `missing` as well as `applied`, and every caller
// refuses to press when anything is missing. A partial write is not a save.

import { radioGroup } from './fields.js';

const same = (a, b) => String(a == null ? '' : a) === String(b == null ? '' : b);

// What a control currently holds. The two readers describe a checkbox slightly
// differently — the editor fills `checked`, the settings screen fills `value` —
// and comparing one of them against `value` would read every checked box as an
// edit. That mismatch is exactly what the first pass of this module shipped.
function currentOf(field) {
  if (field.type !== 'checkbox') return field.value;
  if (field.checked !== undefined && field.checked !== null) return !!field.checked;
  return !!field.value;
}

// Only what changed, as { selector, value|checked|radio } pairs the live page can
// be written with. Unchanged fields are left alone: the app still holds what the
// server sent, and rewriting an identical value fires the app's own listeners
// for nothing.
export function diffFields(fields, values) {
  const changes = [];

  for (const field of fields) {
    const next = values ? values[field.key] : undefined;

    if (field.type === 'checkbox') {
      if (!!next !== currentOf(field)) {
        changes.push({ selector: field.selector, checked: !!next, key: field.key });
      }
      continue;
    }

    if (field.type === 'radio') {
      // The group is written to as a set. No value at all means "this edit did
      // not touch the choice", not "clear the choice".
      if (next == null || same(next, field.value)) continue;
      changes.push({ selector: field.selector, radio: true, value: String(next), key: field.key });
      continue;
    }

    const value = next == null ? '' : String(next);
    if (!same(value, field.value)) {
      changes.push({ selector: field.selector, value, key: field.key });
    }
  }

  return changes;
}

function announce(el) {
  // The app's own handlers (masks, dirty tracking, dependent selects) listen for
  // these; without them a programmatic write can be invisible to them. The event
  // constructor comes from the document's own view so this works in a browser
  // and in a parsed document alike — and if a document has no Event at all, the
  // write still happened, so it is not worth failing the save over.
  try {
    const view = el.ownerDocument && el.ownerDocument.defaultView;
    const Ctor = (view && view.Event) || (typeof Event !== 'undefined' ? Event : null);
    if (!Ctor) return;
    for (const name of ['input', 'change']) {
      el.dispatchEvent(new Ctor(name, { bubbles: true }));
    }
  } catch (err) {
    /* the value is written; the event is a courtesy */
  }
}

// Writes each change into the live page and reports both halves: what landed,
// and what the page did not have. `missing` is the honest answer to "did every
// edit get written", and it is never empty-but-silent.
export function applyFields(doc, changes) {
  const applied = [];
  const missing = [];

  for (const change of changes) {
    // A radio group: the choice is which input in the set is checked, so every
    // one of them is visited and exactly one is left checked.
    if (change.radio) {
      const group = Array.from(doc.querySelectorAll(change.selector));
      if (!group.length) {
        missing.push(change.key);
        continue;
      }
      let chosen = null;
      for (const radio of group) {
        const value = radio.getAttribute('value');
        const on = String(value == null ? '' : value) === String(change.value);
        radio.checked = on;
        if (on) {
          radio.setAttribute('checked', '');
          chosen = radio;
        } else {
          radio.removeAttribute('checked');
        }
      }
      if (chosen) announce(chosen);
      applied.push(change.key);
      continue;
    }

    const el = doc.querySelector(change.selector);
    if (!el) {
      missing.push(change.key);
      continue;
    }

    if (change.checked !== undefined) {
      // Both the property and the attribute: a form read through the DOM sees
      // the property, a serialised one sees the attribute.
      el.checked = change.checked;
      if (change.checked) el.setAttribute('checked', '');
      else el.removeAttribute('checked');
    } else if (el.tagName === 'SELECT') {
      // Select the option itself, in both the attribute and the property: the
      // app reads the selected option, and a select's `value` is not writable
      // in every DOM implementation.
      for (const option of Array.from(el.querySelectorAll('option'))) {
        const optionValue = option.getAttribute('value');
        const match = optionValue != null
          ? optionValue === change.value
          : option.textContent.trim() === change.value;
        // The attribute alone, on purpose: assigning `option.selected` on one
        // option can clear its siblings' selection in some DOM implementations,
        // and the app reads the selected option either way.
        if (match) option.setAttribute('selected', '');
        else option.removeAttribute('selected');
      }
      try { el.value = change.value; } catch (e) { /* attribute is enough */ }
    } else {
      el.value = change.value;
      if (el.tagName === 'INPUT') el.setAttribute('value', change.value);
    }

    announce(el);
    applied.push(change.key);
  }

  return { applied, missing };
}

// The record editor's own form is `{ fields }`; that is all this needs.
export function changesFrom(form, values) {
  return diffFields(form ? form.fields : [], values);
}
