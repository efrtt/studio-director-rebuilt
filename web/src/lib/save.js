// Saving, without reimplementing the app's submit contract.
//
// The rebuilt editor never builds a POST. It compares the values it rendered
// against the ones the page arrived with, writes only what changed into the
// app's *live* controls, and then clicks the app's own Save link. Everything the
// app does on save — hidden ids, method arguments, masks, validation, redirects
// — happens exactly as it does for a normal click, and every field this editor
// does not show keeps the value the server sent.
//
// Measured on a live test record on 2026-10-31 (see tools/save-check.js): Save is
// a full-page form POST, not an XHR, so the browser serialises the live controls
// at submit time and reads what this file wrote. The `input`/`change` events are
// for the app's own masks and dirty tracking, not for the payload — which is why
// no event ladder is needed for a record save.
//
// That is the whole reason this file is small: guessing `#idMeth` and the POST
// body would mean silently dropping a field on a real client record.

export function changesFrom(form, values) {
  const changes = [];

  for (const field of form.fields) {
    const next = values[field.key];

    if (field.type === 'checkbox') {
      if (!!next !== !!field.checked) changes.push({ selector: field.selector, checked: !!next, key: field.key });
      continue;
    }

    const value = next == null ? '' : String(next);
    if (value !== String(field.value == null ? '' : field.value)) {
      changes.push({ selector: field.selector, value, key: field.key });
    }
  }

  return changes;
}

function announce(el) {
  // The app's own handlers (masks, dirty tracking, dependent selects) listen for
  // these; without them a programmatic write can be invisible to them. The event
  // constructor comes from the document's own view so this works in a browser
  // and in a parsed document alike.
  const view = el.ownerDocument && el.ownerDocument.defaultView;
  const Ctor = (view && view.Event) || Event;
  for (const name of ['input', 'change']) {
    el.dispatchEvent(new Ctor(name, { bubbles: true }));
  }
}

export function applyChanges(doc, changes) {
  const applied = [];

  for (const change of changes) {
    // A radio group: the choice is which input in the set is checked, so every
    // one of them is visited and exactly one is left checked.
    if (change.radio) {
      const group = Array.from(doc.querySelectorAll(change.selector));
      if (!group.length) continue;
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
    if (!el) continue;

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

  return applied;
}

// Returns what happened rather than assuming success: if the page has no Save
// link, the caller says so instead of pretending the edit was saved.
export function saveInApp(doc, changes) {
  if (!changes.length) return { applied: [], submitted: false, reason: 'unchanged' };

  const applied = applyChanges(doc, changes);
  const save = doc.getElementById('save');
  if (!save) return { applied, submitted: false, reason: 'no-save-link' };

  save.click();
  return { applied, submitted: true, reason: 'ok' };
}
