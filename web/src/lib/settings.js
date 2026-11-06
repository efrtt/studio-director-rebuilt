// Toggle settings pages: one or two controls and a button.
//
// The crawl found 45 of them and they are the last large bucket with no screen:
// `SetPerforming` (a select and an OK), `SearchDisplayFormat` (two selects),
// `ManageFamilyStudentMax` (two numbers), `ConfigureCalendar` (a radio pair and
// a save), `PortalAccess` (eleven selects), `ManageAbsenceOptions` (four).
//
// They are *not* record editors and most have no form table to read: the crawl
// shows the controls living in plain divs — `PageSettings` uses divs, and
// `ManagePhoneNumbersFormat`'s one select sits in a bare `table.Form` row with no
// record behind it. Whether that table is a form is the shared classifier's
// question; whether the *page* is an editor is the route's. (This comment used to
// explain a four-field floor, which the content-root rule removed.)
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
import { WEEKDAY, humanise, selectorOf } from '../model/fields.js';
import { controlsIn } from '../model/controls.js';
import { labelOfControl, labelOfBlock } from '../model/labels.js';
import { readActions, primaryAction, clickActionInApp } from './actions.js';
import { pageSave } from './save.js';
import { coverageOf } from '../model/coverage.js';
import { pageRegions } from '../model/regions.js';

// At most this many fields: a screen with more is a form (or a table), and the
// editor and sheet readers own those.
const MAX_FIELDS = 30;

// The app marks its search chrome by class, and that chrome is not a setting.
// It is the one control this page adds to the shared policy's ignore list.
const SEARCH_CHROME = /(^|\s)(hidden|searchinput)(\s|$)/;

// What a control is called is `model/labels.js`'s ladder, shared with the record
// editor's rows. This card adds nothing to it: the same page shapes that forced
// the ladder (plain divs, unclassed tables, aria-only labels) are the ones both
// readers see.
// Addressing is `model/fields.js`'s, not this reader's. This had its own copy,
// and the copy trusted any id — the same defect the record editor fixed when an
// id shared with a button-bar anchor sent a save to the anchor. A setting whose
// id is not unique is now addressed by its name, or passed over.

export function readSettings(doc) {
  const root = contentRoot(doc);
  if (!root) return null;

  // Settings pages are not data pages, and which tables are records is the one
  // page-wide judgement (`model/regions.js`), not a count this reader derives
  // itself. It used to walk every table here and count the rows under a heading
  // row — the same question `tableKind` answers — which is a second answer to a
  // question that already has one, and the two drift the day either changes. A
  // layout table of "label cell / control cell" rows is a form by its own rows,
  // which is exactly how some of these pages print their settings, so the doubt
  // this answers is "is any of this records?", not "how many rows are there?".
  if (pageRegions(doc).counts.data) return null;

  const fields = [];
  // Same accounting as the record editor and the payment screen: every control is
  // either shown, or knowingly passed over (a hidden id, the search box, an empty
  // select, a duplicate selector). Anything else is a control this screen does not
  // draw, and it is reported instead of quietly missing.
  const shown = [];
  const passed = [];
  const radioGroups = new Map();
  const checkboxGroups = new Map();
  const seen = new Set();
  // Document order, so the card lists the settings in the order the page does
  // rather than in the order this loop happens to collect them.
  const order = new Map();

  // One walk, shared with the record editor (`model/controls.js`). It is handed
  // this page's content root because a settings page has no row container to
  // give it: its controls live in divs and in bare `<table>` rows with no class
  // (the calendar-filters page, `SetTimeBlockCalendarFilters`), which is exactly
  // why the editor's `table.Form` selector cannot be the shared one.
  const found = controlsIn(root, doc, { skipClass: SEARCH_CHROME });
  for (const el of found.ignored) passed.push(el);

  for (const { el, field } of found.entries) {
    order.set(el, order.size);

    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
    const id = el.getAttribute('id') || '';
    const name = el.getAttribute('name') || '';

    if (type === 'radio') {
      const key = name || id;
      if (!key) {
        passed.push(el);
        continue;
      }
      let group = radioGroups.get(key);
      if (!group) {
        group = { options: [], checked: null, el: el, at: order.get(el) };
        radioGroups.set(key, group);
      }
      shown.push(el);
      const label = labelOfControl(el, doc);
      group.options.push({
        value: el.getAttribute('value') != null ? el.getAttribute('value') : '',
        // The radio's own words when it has them ("Admin calendar"), otherwise
        // the value it submits.
        label: label.source === 'name'
          ? (el.getAttribute('value') || label.label)
          : label.label,
        checked: el.hasAttribute('checked'),
        // Addressing is the shared rule's, so an id that is not unique is not an
        // address. One radio input in a group of two has no unique address of its
        // own — the group is written to as a set, by its name — and this is
        // therefore null, which is the truth; both options used to claim the
        // group's `[name=…]` selector, which named two elements as one.
        selector: selectorOf(el, doc)
      });
      if (el.hasAttribute('checked')) group.checked = el.getAttribute('value');
      continue;
    }

    // The same name repeated is one setting with several choices. The calendar
    // filters' seven DAYS boxes are the weekday mask (1 = Sunday .. 64 =
    // Saturday); read one at a time, six of the seven vanished and the seventh
    // was offered as a single on/off with no day named.
    if (type === 'checkbox' && name && qsa(doc, 'input[name="' + name + '"]').length > 1) {
      let group = checkboxGroups.get(name);
      if (!group) {
        group = { options: [], el, at: order.get(el) };
        checkboxGroups.set(name, group);
      }
      const value = el.getAttribute('value') || '';
      shown.push(el);
      group.options.push({
        // The weekday boxes carry no words of their own: the bit mask is the
        // only name they have, so it is read as the day it stands for.
        label: (/(^|_)days?$/i.test(name) && WEEKDAY[Number(value)]) || textOf(el.closest('label')) || value,
        value,
        // A box with no value still needs an identity of its own to be diffed.
        key: value || '#' + group.options.length,
        checked: el.hasAttribute('checked')
      });
      continue;
    }

    const selector = selectorOf(el, doc);
    if (!selector) {
      passed.push(el);
      continue;
    }
    // Two controls can share a name where only one is addressable; skip the
    // duplicate rather than writing to whichever querySelector finds first.
    if (seen.has(selector)) {
      passed.push(el);
      continue;
    }
    seen.add(selector);

    if (!field) {
      passed.push(el);
      continue;
    }

    shown.push(el);
    const label = labelOfControl(el, doc);
    fields.push({
      key: id || 'name:' + name || selector,
      at: order.get(el),
      label: label.label,
      // 'name' means the label is the field's own name, humanised: the view
      // marks those rows so nobody reads a guess as the app's wording.
      source: label.source,
      selector,
      // Projected, not spread: this card's fields carry type and value, plus
      // options only where the control has them (the model has always left the
      // key off a text box), and a checkbox's value is its state — the editor
      // keeps that same state in `checked`.
      type: field.type,
      ...(field.options ? { options: field.options } : {}),
      value: field.type === 'checkbox' ? !!field.checked : field.value
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
    const label = labelOfBlock(container, doc);
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

  // A checkbox group is one setting, in the order the page puts its boxes. Its
  // label is the block around them (the cell that says "DAYS"), not the first
  // box's own value.
  for (const [name, group] of checkboxGroups) {
    if (!group.options.length) continue;
    const container = group.el.parentElement || group.el;
    const label = labelOfBlock(container, doc);
    fields.push({
      key: 'checks:' + name,
      at: group.at,
      label: label.source === 'name' ? humanise(name) : label.label,
      source: label.source,
      selector: '[name="' + name + '"]',
      group: name,
      type: 'checkboxes',
      options: group.options,
      value: group.options.filter((o) => o.checked).map((o) => o.key)
    });
  }

  if (!fields.length || fields.length > MAX_FIELDS) return null;
  fields.sort((a, b) => (a.at == null ? 0 : a.at) - (b.at == null ? 0 : b.at));

  const unread = coverageOf(root, shown, passed);

  const actions = readActions(root);
  // A setting nobody can save is not a screen this adapter may take over: the
  // app's own Save is what writes it (`#save`), or one of its own controls.
  const save = pageSave(doc);
  if (!actions.length && !save) return null;

  return {
    kind: 'settings',
    title: textOf(qs(doc, '.formTitle, h1')) || 'Settings',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    fields,
    actions,
    primary: primaryAction(actions),
    ...(unread.length ? { unread } : {}),
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
    const save = pageSave(doc);
    if (!save) return { applied, submitted: false, reason: 'missing', label: 'Save' };
    save.click();
    return { applied, submitted: true, reason: 'ok', label: 'Save' };
  }

  const pressed = clickActionInApp(doc, target);
  if (!pressed.submitted) return { applied, ...pressed, label: target.label };
  return { applied, submitted: true, reason: 'ok', label: target.label, via: pressed.via };
}
