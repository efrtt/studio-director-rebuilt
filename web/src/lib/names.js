// Names in a record list.
//
// The panel gives a label and a link. There is no separate first/last field, no
// balance, no phone number — so the only structure available is the one inside
// the label itself, and these helpers read exactly that:
//
//   "Hopper Family"        family, filed under H
//   "Ada Lovelace"         student, filed under L, printed as written
//   "Lovelace, Ada"        the same student, surname first
//   "101 Ballet III"       class, shelf 100s
//   "Jazz I - Tue 5:30p"   class; the meeting time is the one thing besides the
//                          name the label states, so it is the one thing the
//                          shelf can show beside it

const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
const FAMILY = /\s+family$/i;
const DAY = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?/i;
// A class label splits on its last spaced dash; "Ages 6-9" uses a closed dash
// and is part of the name, not a schedule.
const DASHED = /^(.*)\s+[-\u2013\u2014]\s+(.+)$/;

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

export function letterOf(value) {
  const first = fold(value).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

// A–Z, with anything that is not a letter filed last under "#": an index that
// starts with "#" starts with the names nobody was looking for.
export function letterGroups(items, type) {
  const groups = new Map();
  for (const item of items || []) {
    const letter = letterOf(surnameOf(item.label, type || item.type));
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(item);
  }
  const letters = [...groups.keys()].sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return letters.map((letter) => ({ letter, items: groups.get(letter) }));
}

// The class number is the studio's own category: 101, 240 and 299 are all 200s.
// It comes from the link when the link carries it, and from the label only when
// the label leads with a number.
export function classBandOf(item) {
  const href = String((item && item.href) || '');
  const fromHref = href.match(/[?&]cident=(\d+)/i);
  const fromLabel = String((item && item.label) || '').match(/^\s*(\d+)/);
  const id = Number(fromHref ? fromHref[1] : fromLabel ? fromLabel[1] : NaN);
  if (!Number.isFinite(id) || id <= 0) return { band: null, label: 'Other' };
  const band = Math.floor(id / 100) * 100;
  return { band, label: band > 0 ? band + 's' : 'Under 100' };
}

export function classShelves(items) {
  const shelves = new Map();
  for (const item of items || []) {
    const { band, label } = classBandOf(item);
    const key = band == null ? 'other' : String(band);
    if (!shelves.has(key)) shelves.set(key, { band, label, items: [] });
    shelves.get(key).items.push(item);
  }
  return [...shelves.values()].sort((a, b) => {
    if (a.band == null) return 1;
    if (b.band == null) return -1;
    return a.band - b.band;
  });
}

// What a class row can say besides its name. Only a trailing day is treated as
// a schedule; anything else stays part of the name, unguessed.
export function classParts(label) {
  const raw = clean(label);
  const match = raw.match(DASHED);
  if (match && DAY.test(match[2])) return { name: match[1].trim(), when: match[2].trim() };
  return { name: raw, when: '' };
}
