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
// The diff and the write now live in `model/diff.js`; this module is the save
// step and nothing else. The defect fixed here: `submitted: true` used to be
// returned whenever the app's Save existed, even when a change had not been
// written — a selector that missed the live page produced "saved" for an edit
// that never happened. A missing field now refuses, and says which one.

import { qs } from './shell.js';
import { diffFields, applyFields } from '../model/diff.js';
import { SAVE_LINK } from '../model/appdom.js';

// The page's own Save, once.
//
// Five modules asked "is this an editor?" and each asked it a little
// differently: the form reader looked for `#save`, the record ladder for `#save`
// or a tab strip, the settings card for `#save` or any action, the attendance
// register twice more. One definition, so the reader that decides what a screen
// is and the writer that presses its Save cannot drift apart — every write here
// ends by clicking the element this returns.
export function pageSave(doc) {
  // Accepts a document or any element root, and nothing else: the attendance
  // tests hand it a stub with no query engine at all.
  return doc && typeof doc.querySelector === 'function' ? qs(doc, SAVE_LINK) : null;
}

// Kept for the editor view, which asks "what changed?" to enable its button.
export function changesFrom(form, values) {
  return diffFields(form ? form.fields : [], values);
}

// The old name, for callers that only want the applied keys.
export function applyChanges(doc, changes) {
  return applyFields(doc, changes).applied;
}

// Returns what happened rather than assuming success: if a change could not be
// written, or the page has no Save link, the caller is told instead of shown a
// confirmation for an edit that did not land.
//
// The no-op shapes are the ones the tests pin exactly; `missing` appears only
// when there is something to report.
export function saveInApp(doc, changes) {
  if (!changes.length) return { applied: [], submitted: false, reason: 'unchanged' };

  const { applied, missing } = applyFields(doc, changes);
  if (missing.length) {
    return { applied, missing, submitted: false, reason: 'missing' };
  }

  const save = pageSave(doc);
  if (!save) return { applied, submitted: false, reason: 'no-save-link' };

  save.click();
  return { applied, missing, submitted: true, reason: 'ok' };
}
