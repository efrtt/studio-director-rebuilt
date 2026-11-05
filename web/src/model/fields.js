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

// The app's own field names are mostly words run together: `dropchargedate`,
// `allowdropins`, `classroomcapacity`. Splitting camelCase and underscores covers
// some of them; the rest are one lowercase run with no boundary to find, so the
// only honest split is by vocabulary. These are the words this app's field names
// are built from - not a dictionary, and not a guess: a word that does not split
// into these stays whole rather than being chopped into nonsense.
const SPLIT_WORDS = new Set(`
  drop reason notes note charge charges class classes date time enroll enrolls start end close
  allow enable disable show hide send email phone mobile address city state zip
  country name first last middle student students family parent staff teacher
  level skill skills balance amount payment card code type format display print
  page size color colour theme admin calendar search filter save default active
  inactive status group message subject title text logo header footer width
  height count min max limit day week month year from to login password
`.trim().split(/\s+/));

// Longest head first, so `chargedate` prefers `charge` over `char`-like prefixes.
// A tail still has to be a word (or split into them) for the break to be taken.
function splitBare(word) {
  if (word.length < 4 || SPLIT_WORDS.has(word)) return word;
  for (let i = word.length - 2; i >= 3; i--) {
    const head = word.slice(0, i);
    if (!SPLIT_WORDS.has(head)) continue;
    const tail = word.slice(i);
    const rest = splitBare(tail);
    if (rest !== tail || SPLIT_WORDS.has(tail)) return head + ' ' + rest;
  }
  return word;
}

// `familyMax` -> "Family max", `dropreason` -> "Drop reason": the fallback label.
export function humanise(raw) {
  const s = String(raw || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  const out = s.split(' ').map(splitBare).join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

// A control is addressed by id when it has one. Some fields carry only a name
// (`select name="family"`), so a name is used when it is unique on the page —
// never when it could be one of several.
export function selectorOf(el, doc) {
  const id = el.getAttribute('id') || '';
  // An id is the best address, but only when it addresses one element. Record
  // pages print a button-bar anchor with the same id as a field
  // (`<a id="email">Email</a>` beside `input#email` on EditFamily), and
  // `querySelector('#email')` then returns the anchor: a save wrote the value onto
  // an anchor, reported success, and the app submitted what it already had. Where
  // the id is not unique, the control's own name is the address that works.
  if (id && qsa(doc, '[id="' + id + '"]').length === 1) return '#' + id;
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
