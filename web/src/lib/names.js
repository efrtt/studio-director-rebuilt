// Names in a record list.
//
// The panel gives a label and a link. There is no separate first/last field, no
// balance, no phone number — so the only structure available is the one inside
// the label itself, and these helpers read exactly that:
//
//   "Hopper Family"        family, filed under H
//   "Ada Lovelace"         student, filed under L, printed as written
//   "Lovelace, Ada"        the same student, surname first
//   "100 Ballet 1"         class, filed under 1 — the hundred it belongs to
//   "Hip Hop"              class with no number, filed under H
//   "Jazz I - Tue 5:30p"   class; the meeting time is the one thing besides the
//                          name the label states, so it is the one thing a row
//                          can show beside it

const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
const FAMILY = /\s+family$/i;
const DAY = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?/i;
// A class label splits on its last spaced dash; "Ages 6-9" uses a closed dash
// and is part of the name, not a schedule.
const DASHED = /^(.*)\s+[-\u2013\u2014]\s+(.+)$/;
// The class number, which the studio uses as its category.
const NUMBERED = /^\s*(\d+)/;
const CIDENT = /[?&]cident=(\d+)/i;

function clean(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

// A diacritic does not make a name unfilable: Audet and Áudet both live under A.
function fold(value) {
  const text = clean(value);
  if (!text) return '';
  try {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {
    return text;
  }
}

// "Lovelace, Ada" is the same person as "Ada Lovelace". The list prints the name
// the way it is said; the comma form is only how it was filed.
export function displayLabel(label) {
  const raw = clean(label);
  const comma = raw.indexOf(',');
  if (comma > 0) {
    const last = raw.slice(0, comma).trim();
    const first = raw.slice(comma + 1).trim();
    if (last && first) return first + ' ' + last;
  }
  return raw;
}

// What the list is filed under. A family has no first name, so its surname is
// the whole label minus the word "Family".
export function surnameOf(label, type) {
  const shown = displayLabel(label);
  if (!shown) return '';
  if (String(type || '') === 'Family' || FAMILY.test(shown)) {
    return shown.replace(FAMILY, '').trim() || shown;
  }
  const parts = shown.split(' ').filter(Boolean);
  while (parts.length > 1 && SUFFIX.test(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1] || shown;
}

// What a class row can say besides its name. Only a trailing day is treated as
// a schedule; anything else stays part of the name, unguessed.
export function classParts(label) {
  const raw = clean(label);
  const match = raw.match(DASHED);
  if (match && DAY.test(match[2])) return { name: match[1].trim(), when: match[2].trim() };
  return { name: raw, when: '' };
}

// The number a class row is filed under: the hundred, taken from the class
// number itself. "100 Ballet 1" files under 1, "520 Contemporary 1" under 5. The
// number comes from the link when the label does not lead with one.
export function classNumber(item) {
  const label = String((item && item.label) || '');
  const href = String((item && item.href) || '');
  const digits = (label.match(NUMBERED) || [])[1] || (href.match(CIDENT) || [])[1] || '';
  return digits;
}

// The single character a row is filed under: a surname's letter, or a class's
// hundred.
export function indexKey(item, type) {
  const kind = String(type || (item && item.type) || '');
  if (kind === 'Class') {
    const digits = classNumber(item);
    if (digits) return digits.charAt(0);
    // A class with no number anywhere is still a class: it joins the A-Z run,
    // filed by its name, with any meeting time taken off first.
    return classParts((item && item.label) || '').name;
  }
  return surnameOf((item && item.label) || '', kind);
}

export function letterOf(value) {
  const first = fold(value).charAt(0).toUpperCase();
  return /^[A-Z0-9]$/.test(first) ? first : '#';
}

// Numbers first, then A–Z, with anything unindexable last under "#": an index
// that starts with "#" starts with the rows nobody was looking for.
export function letterGroups(items, type) {
  const groups = new Map();
  for (const item of items || []) {
    const letter = letterOf(indexKey(item, type));
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(item);
  }
  const rank = (key) => (key === '#' ? 2 : /^[0-9]$/.test(key) ? 0 : 1);
  const letters = [...groups.keys()].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return letters.map((letter) => ({ letter, items: groups.get(letter) }));
}
