// Record list adapter.
//
// Confirmed from a live dump of page=NewClass. That page is a create/edit form
// (table.FormEx, 40+ controls); the list of existing records sits beside it in
// the side panel:
//
//   #idSearchSpan.searchResultPanel
//     .searchResultBar > .searchResultLabel      heading ("Classes")
//     .searchResultLabel > input#filter          the app's own client filter
//     .searchResultList > .searchResultItem > a  one row per record
//
// NewFamily and NewStudent use the same shell, so this adapter is not specific
// to classes: it reads whatever the panel calls itself and shows that verbatim.

import { pageName, qs, qsa, textOf } from './shell.js';

// What a row is. The link says it best (`?page=EditFamily`), and the app's own
// label often says it too ("Family: Hopper Family"); the label prefix is then
// taken off, because the badge repeats it.
const TYPE_BY_PAGE = {
  editfamily: 'Family', newfamily: 'Family',
  editstudent: 'Student', newstudent: 'Student',
  editclass: 'Class', newclass: 'Class',
  editinstructor: 'Instructor', newinstructor: 'Instructor'
};
const LABEL_TYPE = /^\s*(family|families|student|students|class|classes|instructor|instructors)\s*:\s*/i;
const SINGULAR = {
  family: 'Family', families: 'Family',
  student: 'Student', students: 'Student',
  class: 'Class', classes: 'Class',
  instructor: 'Instructor', instructors: 'Instructor'
};

// The panel is a window onto the record set, not the whole set: the app sends
// 500 rows. Two places say how many exist, and the live page uses both — the
// panel's own heading reads "4291 Items", and some versions print "Filter 4291
// items" in the filter box. Nothing here guesses a total it was not given.
const COUNT = /^\s*(\d[\d,]*)\s+items?\s*$/i;

function totalOf(doc) {
  const heading = textOf(qs(doc, '.searchResultBar .searchResultLabel'));
  const fromHeading = heading.match(COUNT);
  if (fromHeading) return Number(fromHeading[1].replace(/,/g, ''));

  const filter = qs(doc, '#filter');
  const m = String((filter && filter.getAttribute('placeholder')) || '')
    .match(/(\d[\d,]*)\s+items?/i);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

export function readList(doc, opts = {}) {
  const list = qs(doc, '#idSearchSpan .searchResultList') || qs(doc, '.searchResultList');
  if (!list) return null;

  const seen = new Set();
  const items = [];

  for (const node of qsa(list, '.searchResultItem')) {
    const anchor = node.tagName === 'A' ? node : qs(node, 'a[href]');
    let label = textOf(anchor || node);
    if (!label) continue;

    const href = anchor ? anchor.getAttribute('href') : null;
    let type = TYPE_BY_PAGE[pageName(href || '').toLowerCase()] || null;

    const prefix = label.match(LABEL_TYPE);
    if (prefix) {
      type = type || SINGULAR[prefix[1].toLowerCase()] || null;
      label = label.slice(prefix[0].length).trim();
      if (!label) continue;
    }

    const key = (href || '') + '|' + label;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({ label, href, type });
  }

  // A search page with nothing to show still has a panel and a heading: an
  // empty list is a result ("no matches"), not a missing page.
  if (!items.length && !opts.allowEmpty) return null;

  const heading = qs(doc, '.searchResultBar .searchResultLabel') || qs(doc, '.searchResultLabel');

  const total = totalOf(doc);
  const headingText = textOf(heading);

  const types = [...new Set(items.map((item) => item.type).filter(Boolean))];

  return {
    kind: 'list',
    // Badges are only worth their noise when a list mixes record types, which
    // is exactly the search results page.
    types,
    mixed: types.length > 1,
    // Verbatim: "Classes", "Families", "Students" - whatever the panel says.
    // A count is not a name, so when the heading is "4291 Items" the app's own
    // page title stands in.
    label: headingText && !COUNT.test(headingText)
      ? headingText
      : (textOf(qs(doc, '.formTitle')) || 'Records'),
    items,
    // null when the page does not say, so a caller cannot "know" a total it
    // was never given.
    total: total != null && total >= items.length ? total : null,
    truncated: total != null && total > items.length,
    title: textOf(qs(doc, '.formTitle, .ReportName, h1')) || ''
  };
}
