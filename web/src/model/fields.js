// Control reading shared by the record editor and the settings screen.
//
// Both readers had copies of these: the select-option walk, the weekday
// bitmask, the humanised fallback label. They had already drifted — the
// editor's copy did not know about radios at all, so a record form carrying a
// radio pair silently dropped it, while the settings reader grouped radios
// correctly. The primitives live here once; each reader still assembles its own
// field list, because "what is a field on this screen" is a different question
// from "what does this control say".

import { qsa, textOf } from '../lib/shell.js';

// Weekday checkboxes are `#day__<bit>` with no label of their own; left alone
// every one of them reads "day". 1 = Sunday keeps the bit order the app uses
// (a Monday class has day__2 checked). It is a label only: the value is still
// written through the control's own id.
export const WEEKDAY = { 1: 'Sun', 2: 'Mon', 4: 'Tue', 8: 'Wed', 16: 'Thu', 32: 'Fri', 64: 'Sat' };

// The class editor names them `day__2`; the reports prefix the same ids with
// their own subject (`classes_day__2`, `students_day__4`).
export function weekdayOf(id) {
  const m = /(?:^|_)day__(\d+)$/.exec(id || '');
  return m ? WEEKDAY[Number(m[1])] || null : null;
}

export function optionsOf(select) {
  return qsa(select, 'option').map((o) => ({
    value: o.getAttribute('value') != null ? o.getAttribute('value') : textOf(o),
    label: textOf(o),
    selected: o.hasAttribute('selected')
  }));
}

export function valueOfSelect(options) {
  const chosen = options.find((o) => o.selected);
  return (chosen || options[0] || { value: '' }).value;
}

// `familyMax` -> "Family max": the fallback label, marked as such by the view so
// nobody reads a guess as the app's own wording.
export function humanise(raw) {
  const s = String(raw || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// A control is addressed by id when it has one. Some fields carry only a name
// (`select name="family"`), so a name is used when it is unique on the page —
// never when it could be one of several.
export function selectorOf(el, doc) {
  const id = el.getAttribute('id') || '';
  if (id) return '#' + id;
  const name = el.getAttribute('name') || '';
  // `name="-"` is the app's placeholder for a helper input that submits nothing.
  // It is unique on the page, so without this it would become a field called "-";
  // the editor has always skipped it and the pinned model depends on that.
  if (!name || name === '-') return null;
  if (qsa(doc, '[name="' + name + '"]').length === 1) return '[name="' + name + '"]';
  return null;
}

// A radio group: the choice is which input in the set is checked, so the group
// is addressed as a set and its value is the chosen input's value. Writing to
// `document.querySelector('[name=x]')` alone would always hit the first input
// and silently leave the choice where it was.
export function radioGroup(name, radios) {
  const options = radios.map((el) => ({
    value: el.getAttribute('value') != null ? el.getAttribute('value') : '',
    label: '',
    checked: el.hasAttribute('checked')
  }));
  const chosen = options.find((o) => o.checked);
  return {
    type: 'radio',
    group: name,
    selector: '[name="' + name + '"]',
    options,
    value: chosen ? chosen.value : ''
  };
}
