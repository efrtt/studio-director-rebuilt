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
//
// A page can carry more than one panel. The search results page does: the panel
// it is showing is the result set, while a record panel left over from the page
// searched from is still in the document. Reading the first panel in document
// order therefore showed the family list and *then* the results, so the panel is
// chosen by what it says about itself rather than by where it sits.

import { pageName, qs, qsa, textOf, titleOf, breadcrumbOf } from './shell.js';
import { RESULT_BAR, RESULT_ITEM, RESULT_LABEL, RESULT_PANEL_CLASS, SEARCH_SPAN } from '../model/appdom.js';
import { resultPanel, panelRows } from '../model/regions.js';
import { contentRoot } from '../model/root.js';

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

// The panel is a window onto the record set, not the whole set: the app sends it
// in windows — 500 rows of "2114 Items" on the live search page — and finishes
// the rest itself a few seconds later. The heading is where the total is stated;
// "Filter 2114 items" in the filter box is the other place. Nothing here guesses
// a total it was not given.
const COUNT = /^\s*(\d[\d,]*)\s+items?\s*$/i;

function panelOf(list) {
  try {
    return (list.closest && (list.closest(RESULT_PANEL_CLASS) || list.closest(SEARCH_SPAN))) || null;
  } catch (e) {
    return null;
  }
}

// The panel's own label first; then the label the content root prints, which is
// the same root every other reader asks. The document is never searched, so a
// panel belonging to a screen you are not on cannot name this one.
function headingOf(list, doc) {
  const root = contentRoot(doc);
  const panel = panelOf(list);
  return (panel && qs(panel, RESULT_LABEL))
    || qs(root, RESULT_BAR + ' ' + RESULT_LABEL)
    || qs(root, RESULT_LABEL);
}

function pickList(doc) {
  const found = resultPanel(doc);
  return found ? found.panel : null;
}

function totalOf(doc, list) {
  const heading = textOf(headingOf(list, doc));
  const fromHeading = heading.match(COUNT);
  if (fromHeading) return Number(fromHeading[1].replace(/,/g, ''));

  const panel = panelOf(list);
  const filter = (panel && qs(panel, '#filter')) || qs(contentRoot(doc), '#filter');
  const m = String((filter && filter.getAttribute('placeholder')) || '')
    .match(/(\d[\d,]*)\s+items?/i);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

// A cheap look at the panel, in the shape the search wait asks its questions of.
//
// The wait needs to know three things: what the page calls itself, how many
// records the panel claims, and which record it starts with. A whole `readList`
// answers those and walks every row to do it — thousands of them on a live
// search — so asking it every 120ms starved the page the wait was for, and the
// skin could appear ten seconds late, or not at all.
//
// The first row and the stated total are enough: a different first record or a
// different total is a different record set (`lib/choose.js`), and the rest of
// the rows are read once, after the panel has said what it is.
export function panelPeek(doc) {
  const title = titleOf(doc, 'div') || '';
  const list = pickList(doc);
  if (!list) return { view: null, title, list: null };

  const heading = textOf(headingOf(list, doc));
  const total = totalOf(doc, list);
  const row = qs(list, RESULT_ITEM);
  const anchor = row ? (row.tagName === 'A' ? row : qs(row, 'a[href]')) : null;
  const label = textOf(anchor || row);

  return {
    view: 'list',
    title,
    list: {
      title,
      // The same naming rule as `readList`: a count is not a name.
      label: heading && !COUNT.test(heading) ? heading : title,
      total,
      items: label ? [{ label, href: anchor ? anchor.getAttribute('href') : null }] : []
    }
  };
}

export function readList(doc, opts = {}) {
  const list = pickList(doc);
  if (!list) return null;

  const seen = new Set();
  const items = [];

  for (const { el: node } of panelRows(list).filter((row) => row.kind === 'repeated')) {
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

  const total = totalOf(doc, list);
  const headingText = textOf(headingOf(list, doc));

  const types = [...new Set(items.map((item) => item.type).filter(Boolean))];

  return {
    kind: 'list',
    // Badges are only worth their noise when a list mixes record types, which
    // is exactly the search results page.
    types,
    mixed: types.length > 1,
    // Verbatim: "Classes", "Families", "Students" - whatever the panel says.
    // A count is not a name, so when the heading is "2114 Items" the app's own
    // page title stands in.
    label: headingText && !COUNT.test(headingText)
      ? headingText
      : (titleOf(doc, 'div') || 'Records'),
    items,
    // null when the page does not say, so a caller cannot "know" a total it
    // was never given.
    total: total != null && total >= items.length ? total : null,
    truncated: total != null && total > items.length,
    title: titleOf(doc) || ''
  };
}
