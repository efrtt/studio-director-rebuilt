// Toggle settings pages: one or two controls and a button.
//
// The crawl found 45 of them and they are the last large bucket with no screen:
// `SetPerforming` (a select and an OK), `SearchDisplayFormat` (two selects),
// `ManageFamilyStudentMax` (two numbers), `ConfigureCalendar` (a radio pair and
// a save), `PortalAccess` (eleven selects), `ManageAbsenceOptions` (four).
//
// They are *not* record editors and they have no `table.Form` to read: the crawl
// shows the controls living in plain divs — `PageSettings` uses divs, and
// `ManagePhoneNumbersFormat`'s one select is inside a `table.Form` too small for
// the editor's four-field floor.
//
// So this reader walks the controls themselves and finds each one's label the
// way a person reading the page does:
//
//   1. `<label for="…">`                       the app's own label
//   2. the cell before it in a table row       label column, control column
//   3. `aria-label` / `title`
//   4. the element before it in its block      `<div>Name</div><input>`
//   5. its own id or name, humanised           `familyMax` -> "Family max"
//
// Step 5 is a fallback, and the view says so: a row whose label came from the
// field's name is marked, rather than passing a guess off as the app's wording.
//
// Radios are grouped by name — they are mutually exclusive by definition, and
// `admincal` is one setting with two choices, not two settings.

import { qs, qsa, textOf } from './shell.js';
import { diffFields, applyFields } from '../model/diff.js';
import { contentRoot } from '../model/root.js';
import { optionsOf, humanise } from '../model/fields.js';
import { readActions, primaryAction, clickActionInApp } from './actions.js';

// At most this many fields: a screen with more is a form (or a table), and the
// editor and sheet readers own those.
const MAX_FIELDS = 30;

const SKIP_IDS = new Set(['filter', 'filterInput', 'searchidx', 'idPage', 'idMeth', 'idMethArgs', 'searchText', 'ResetPwdFlag']);
const SKIP_TYPES = new Set(['hidden', 'file', 'submit', 'button', 'reset', 'image']);
// The record panel's own filter and the global search box are not settings.
const SKIP_NAMES = new Set(['filter', 'searchText', 'idPage', 'idMeth']);

function skipped(el) {
  const tag = el.tagName.toLowerCase();
  const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
  if (SKIP_TYPES.has(type)) return true;
  const id = el.getAttribute('id') || '';
  const name = el.getAttribute('name') || '';
  if (id && SKIP_IDS.has(id)) return true;
  if (name && SKIP_NAMES.has(name)) return true;
  // The app marks its own non-settings chrome this way.
  if (/(^|\s)(hidden|searchinput)(\s|$)/.test(el.getAttribute('class') || '')) return true;
  return false;
}

const CONTROL = 'input, select, textarea, button';

// The words around a control, without using the control's own wrapper as a
// label: "the cell before it", "the block before it", "the title it carries".
// Shared by single controls and by a radio group's container.
// Page furniture that is never a field's label: the title above the first
// control, a breadcrumb, a button row.
const FURNITURE = '.formTitle, .Breadcrumb, .ButtonBar, .ButtonArea, .menu';

// A control is not a label for the control after it. Two date pickers side by
// side with nothing between them would otherwise take turns naming each other —
// the second one's "label" came back as the first one's selected option.
function isControl(el) {
  return !!(el.matches && el.matches(CONTROL));
}

function blockLabel(el, doc) {
  const cell = el.closest && el.closest('td');
  let prev = cell && cell.previousElementSibling;
  while (prev) {
    const text = textOf(prev);
    // A cell that only holds another control is not a label.
    if (text && !isControl(prev) && !qsa(prev, CONTROL).length) return { label: text.slice(0, 120), source: 'cell' };
    prev = prev.previousElementSibling;
  }

  const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
  if (aria) return { label: aria.slice(0, 120), source: 'title' };

  // The block before it: `<div class="SettingLabel">Send to</div><select>`.
  let before = el.previousElementSibling;
  while (before) {
    if (isControl(before) || (before.matches && before.matches(FURNITURE))) {
      before = before.previousElementSibling;
      continue;
    }
    const text = textOf(before);
    if (text && text.length <= 120 && !qsa(before, CONTROL).length) {
      return { label: text, source: 'block' };
    }
    before = before.previousElementSibling;
  }

  const name = el.getAttribute('name') || '';
  return { label: humanise(el.getAttribute('id') || name) || 'Setting', source: 'name' };
}

// What a person would read above this control. Returns { label, source } so the
// view can be honest about a label it had to guess from the field name.
export function labelFor(el, doc) {
  const id = el.getAttribute('id') || '';

  if (id) {
    const text = textOf(doc.querySelector('label[for="' + id + '"]'));
    if (text) return { label: text, source: 'label' };
  }

  // A label that wraps the control ("<label><input> Yes</label>").
  const wrapText = textOf(el.closest && el.closest('label'));
  if (wrapText) return { label: wrapText.slice(0, 120), source: 'label' };

  return blockLabel(el, doc);
}

function controlOf(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'select') {
    const options = optionsOf(el);
    // An empty select is filled in by the app's own JS (the date pickers), so it
    // cannot be offered as a setting.
    if (!options.length) return null;
    const chosen = options.find((o) => o.selected) || options[0];
    return { type: 'select', options, value: chosen.value };
  }
  if (tag === 'textarea') return { type: 'textarea', value: textOf(el) };
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  if (type === 'checkbox') return { type: 'checkbox', value: !!el.hasAttribute('checked') };
  return { type: 'text', value: el.getAttribute('value') || '' };
}

function selectorOf(el, doc) {
  const id = el.getAttribute('id') || '';
  if (id) return '#' + id;
  const name = el.getAttribute('name') || '';
  if (name && qsa(doc, '[name="' + name + '"]').length === 1) return '[name="' + name + '"]';
  if (name) return '[name="' + name + '"]';
  return null;
}

export function readSettings(doc) {
  const root = contentRoot(doc);
  if (!root) return null;

  // Settings pages are not data pages. A *headed* table with rows is a sheet,
  // and that is what stops this adapter from taking one over. A layout table of
  // "label cell / control cell" rows has no headings and is exactly how some of
  // these pages print their settings.
  const headed = qsa(root, 'table').reduce((n, table) => {
    const heads = Array.from(table.children)
      .flatMap((c) => (c.tagName === 'TBODY' || c.tagName === 'THEAD' ? Array.from(c.children) : [c]))
      .filter((tr) => tr.tagName === 'TR' && Array.from(tr.children).some((c) => c.tagName === 'TH'));
    if (!heads.length) return n;
    return n + Array.from(table.querySelectorAll('tr')).filter((tr) => tr.querySelector('td')).length;
  }, 0);
  if (headed >= 2) return null;

  const fields = [];
  const radioGroups = new Map();
  const seen = new Set();
  // Document order, so the card lists the settings in the order the page does
  // rather than in the order this loop happens to collect them.
  const order = new Map();

  for (const el of qsa(root, 'input, select, textarea')) {
    if (skipped(el)) continue;
    order.set(el, order.size);

    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
    const id = el.getAttribute('id') || '';
    const name = el.getAttribute('name') || '';

    if (type === 'radio') {
      const key = name || id;
      if (!key) continue;
      let group = radioGroups.get(key);
      if (!group) {
        group = { options: [], checked: null, el: el, at: order.get(el) };
        radioGroups.set(key, group);
      }
      const label = labelFor(el, doc);
      group.options.push({
        value: el.getAttribute('value') != null ? el.getAttribute('value') : '',
        // The radio's own words when it has them ("Admin calendar"), otherwise
        // the value it submits.
        label: label.source === 'name'
          ? (el.getAttribute('value') || label.label)
          : label.label,
        checked: el.hasAttribute('checked'),
        selector: selectorOf(el, doc)
      });
      if (el.hasAttribute('checked')) group.checked = el.getAttribute('value');
      continue;
    }

    const selector = selectorOf(el, doc);
    if (!selector) continue;
    // Two controls can share a name where only one is addressable; skip the
    // duplicate rather than writing to whichever querySelector finds first.
    if (seen.has(selector)) continue;
    seen.add(selector);

    const control = controlOf(el);
    if (!control) continue;

    const label = labelFor(el, doc);
    fields.push({
      key: id || 'name:' + name || selector,
      at: order.get(el),
      label: label.label,
      // 'name' means the label is the field's own name, humanised: the view
      // marks those rows so nobody reads a guess as the app's wording.
      source: label.source,
      selector,
      ...control
    });
  }

  // Radios become one field, in the order the page puts them. Its label is the
  // block *around* the choices ("Calendar style"), never the first choice's own
  // words ("Admin calendar") — that would name the setting after one of its
  // values.
  for (const [name, group] of radioGroups) {
    if (!group.options.length) continue;
    const first = group.options[0];
    const container = (group.el.closest('label') && group.el.closest('label').parentElement)
      || group.el.parentElement
      || group.el;
    const label = blockLabel(container, doc);
    fields.push({
      key: 'radio:' + name,
      at: group.at,
      label: label.source === 'name' ? humanise(name) : label.label,
      source: label.source,
      // The group's selector: a radio choice is written to the *set*, not to
      // whichever input happened to come first.
      selector: name ? '[name="' + name + '"]' : (first.selector || ''),
      group: name,
      type: 'radio',
      options: group.options,
      value: group.checked != null ? group.checked : (group.options.find((o) => o.checked) || {}).value || ''
    });
  }

  if (!fields.length || fields.length > MAX_FIELDS) return null;
  fields.sort((a, b) => (a.at == null ? 0 : a.at) - (b.at == null ? 0 : b.at));

  const actions = readActions(root);
  // A setting nobody can save is not a screen this adapter may take over: the
  // app's own Save is what writes it (`#save`), or one of its own controls.
  const save = doc.getElementById('save');
  if (!actions.length && !save) return null;

  return {
    kind: 'settings',
    title: textOf(qs(doc, '.formTitle, h1')) || 'Settings',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    fields,
    actions,
    primary: primaryAction(actions),
    save: save
      ? { id: 'save', label: (textOf(save) || 'Save').trim(), href: save.getAttribute('href') || '#', js: true }
      : null
  };
}

// Only what changed, as { selector, value|checked|radio } pairs the live page can
// be written with. The comparison itself is shared with the editor (model/diff.js).
export function settingsChanges(settings, values) {
  return diffFields(settings.fields, values);
}

// Write the edits into the live page and press the chosen control — the app's
// Save link when there is one, otherwise the button the caller picked.
//
// The chosen control is looked up the way every other action is (by id, then by
// an unambiguous label), because not every page's button is a link: the enroll
// step's are divs carrying the app's own onclick.
export function saveSettingsInApp(doc, settings, values, action) {
  const changes = settingsChanges(settings, values);
  const { applied, missing } = applyFields(doc, changes);
  const target = action || settings.primary || settings.save;

  // A setting that could not be written stops the press: the app would save the
  // value it already holds while this screen shows the one the user picked.
  if (missing.length) return { applied, missing, submitted: false, reason: 'missing' };
  if (!target) return { applied, submitted: false, reason: 'no-action' };
  if (target === settings.save || target.id === 'save') {
    const save = doc.getElementById('save');
    if (!save) return { applied, submitted: false, reason: 'missing', label: 'Save' };
    save.click();
    return { applied, submitted: true, reason: 'ok', label: 'Save' };
  }

  const pressed = clickActionInApp(doc, target);
  if (!pressed.submitted) return { applied, ...pressed, label: target.label };
  return { applied, submitted: true, reason: 'ok', label: target.label, via: pressed.via };
}
