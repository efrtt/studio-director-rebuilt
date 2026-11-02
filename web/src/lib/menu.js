// Which of the app's landing pages a screen is, and how it should be drawn.
//
// The reader decides a menu's layout from the page's own title, and the jump
// palette needs the same answer to open with the destinations nearest the page
// you are on. One table, read by both, so the two can never disagree about what
// "Reports Home" is.
//
// Why two layouts at all: Settings and Reports are reference pages — a hundred
// destinations whose categories are the point, so they want a grouped list with
// a rail you can scan. Charges & Payments and Communications are short lists of
// jobs, and nine jobs read better as cards that say what each one is for than as
// a wall of links. The palette sits on top of every page either way.

export const MENUS = [
  { title: 'AdminHome', name: 'Settings', layout: 'grouped' },
  { title: 'ReportsHome', name: 'Reports', layout: 'grouped' },
  { title: 'ChargesHome', name: 'Charges & Payments', layout: 'cards' },
  { title: 'EmailTextHome', name: 'Communications', layout: 'cards' }
];

// The titles the app prints, and the variations the crawl found: the Reports page
// calls itself "Reports Home", and a page title can carry a suffix.
const NAMES = [
  { match: /^reports(\s|$)/i, name: 'Reports' },
  { match: /^settings(\s|$)/i, name: 'Settings' },
  { match: /^charges\s*&\s*payments$/i, name: 'Charges & Payments' },
  { match: /^communications?(\s|$)/i, name: 'Communications' }
];

export function menuFor(title) {
  const text = String(title || '').trim();
  const hit = NAMES.find((entry) => entry.match.test(text));
  return hit ? hit.name : '';
}

export function layoutFor(menu) {
  const row = MENUS.find((entry) => entry.name === menu);
  return row ? row.layout : 'grouped';
}

// The layout a page gets, from the title the reader read off it. A menu this
// build has not seen before is grouped: that is the safer of the two, because it
// keeps every link on screen.
export function layoutForTitle(title) {
  return layoutFor(menuFor(title));
}
