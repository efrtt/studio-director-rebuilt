// Table screens: the tables the rebuilt UI had not touched.
//
// The crawl found 62 of them — `HomePage`'s schedule, `Trends`, `Alerts`,
// `ManageSizes`, `ManageVendors`, `CopyClasses`, `PrintClassRoster`, and every
// `Print*` sheet. They are one shape: one or more tables with headings and
// rows, no writer of its own. Nothing here is edited, so the view is a reading
// surface: a filter, the tables with their own column labels, and the page's
// controls where they can be pressed safely (see model/press.js).
//
// Two kinds of table are never read here:
//   - the week calendar's `table.TimeBlock`, which has its own view;
//   - the record panel's list, which is a list, not a table.
//
// A page with fewer than two data rows is not a sheet (`readIndex` covers the
// bare-link menus), and a page with a form and a real control is a task, which
// is why routing tries this after task.

import { qs, qsa, textOf } from './shell.js';
import { readPageTabs } from './pagetabs.js';
import { labelAbove } from './heading.js';
import { readTable } from '../model/table.js';
import { readActions } from './actions.js';
import { contentRoot } from '../model/root.js';
import { pageRegions } from '../model/regions.js';
import { TABLE_ROWS } from './thresholds.js';

// Which tables are records is `model/regions.js`'s judgement: a table is data
// when its own rows read as records — a heading row, or repeated rows of values
// — and not when it is the rail, a calendar grid, the weekday checkbox grid, a
// form (declared, typed into, or field rows without headings) or a spacer.
// That includes the attendance grid: a table of selects and notes boxes read as
// data collapsed into "Reason:SickInjury…Studio notes:", which is why a table
// that is typed into is a form and the app keeps it.

// A heading above a table ("Class Trends") is the table's own section label.
const SECTION = '.WithinSectionSpace, .sectionHeader, .sectionTitle, .ReportTableSubtitle, h2, h3, h4';

export function readSheet(doc) {
  const root = contentRoot(doc);
  if (!root) return null;

  const tables = [];
  let rows = 0;

  const regions = pageRegions(doc);
  for (const { table, kind } of regions.tables) {
    if (table.closest && table.closest('table') !== table) continue;
    // One page-wide judgement, asked of every table: only records are read here.
    if (kind !== 'data') continue;

    const read = readTable(table);
    if (!read.headings.length && !read.rows.length) continue;
    // A two-column table with no headings is a form laid out as a table —
    // "label cell, control cell" — which is how several settings pages print
    // themselves. It is not a list of records, and the settings reader is the
    // one that should get it.
    if (!read.headings.length && read.rows.every((row) => row.length <= 2)) continue;

    // The nearest heading before this table, if the page puts one there.
    const heading = previousHeading(table, root);
    tables.push({ ...read, section: heading, ...followingContent(table) });
    rows += read.rowTotal != null ? read.rowTotal : read.rows.length;
  }

  if (!tables.length) return null;
  // An empty table is still a screen when the app says so: `ManageScheduledEmails`
  // prints a four-column heading row and "No items to display." underneath it.
  // The two-row floor refused that, and the page rendered as nothing at all
  // rather than as the empty table it is.
  const emptyNotice = tables.some((table) => table.headings.length && table.message);
  if (rows < TABLE_ROWS && !emptyNotice) return null;

  const actions = readActions(root);
  const tabs = readPageTabs(doc);

  return {
    kind: 'sheet',
    title: textOf(qs(doc, '.formTitle, .ReportName, h1')) || crumbTitle(doc) || tables[0].headings[0] || 'Data',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    tables,
    rows,
    // How many rows this view actually carries, when a table was cut short.
    shown: tables.reduce((n, t) => n + t.rows.length, 0),
    truncated: rows > tables.reduce((n, t) => n + t.rows.length, 0),
    actions,
    // The app's own tab strip, when the page prints one: `HomePage` shows
    // Insights and Trends this way, and each is a different screen with its own
    // `tab=` in the URL. Without the strip the second one was unreachable.
    ...(tabs.length ? { tabs } : {})
  };
}

// What the app prints straight after a table.
//
// `PerfCostumeMgmt` is the shape: why the table is empty ("No items to
// display."), its totals ("Total Performance Fee: 0.00"), then an action bar — a
// paragraph that is nothing but links, offering "Add New Performance" and
// "Enter Student Measurements & Sizes". Those links are the only way to add
// anything on that screen, and all of it was dropped: the message because
// nothing read it, the links because `readActions` drops plain links on purpose
// (on most screens a link is a reference, not a control).
//
// The links navigate, so they stay links — but they belong beside the table they
// act on, which is where the app puts them.
const MESSAGE = /ReportTableNoItemsMsg/i;
const TOTAL = /WithinMultiTable/i;
const MAX_STEPS = 5;

function linksOnly(el) {
  const anchors = qsa(el, 'a[href]');
  if (!anchors.length) return [];
  let rest = String(el.textContent || '');
  for (const anchor of anchors) rest = rest.replace(anchor.textContent, '');
  // Words of its own make it prose, and a link in prose is a reference.
  if (rest.replace(/[\s|\u00b7,\u2022]+/g, '')) return [];
  return anchors
    .map((anchor) => ({ label: textOf(anchor), href: anchor.getAttribute('href') }))
    .filter((link) => link.label);
}

function followingContent(table) {
  const links = [];
  let message = '';
  let total = '';
  let node = table.nextElementSibling;
  let steps = 0;

  while (node && steps < MAX_STEPS) {
    // The next table's own label ends this one's run.
    if (node.tagName === 'TABLE') break;
    if (node.matches && (node.matches('.ReportTableSubtitle') || node.matches(SECTION))) break;

    const cls = String(node.getAttribute('class') || '');
    if (MESSAGE.test(cls)) {
      if (!message) message = textOf(node);
    } else if (TOTAL.test(cls)) {
      if (!total) total = textOf(node);
    } else if (node.tagName === 'P') {
      const found = linksOnly(node);
      if (found.length) {
        for (const link of found) {
          if (!links.some((l) => l.href === link.href && l.label === link.label)) links.push(link);
        }
        // One action bar per table: the app prints it last.
        break;
      }
      if (/^totals?\b/i.test(textOf(node)) && !total) total = textOf(node);
    }

    node = node.nextElementSibling;
    steps += 1;
  }

  return {
    ...(message ? { message } : {}),
    ...(total ? { total } : {}),
    ...(links.length ? { links } : {})
  };
}

// Report pages carry no heading: their name is the last crumb of
// `div.ReportBreadcrumb`, followed by the moment the report ran —
// "Business Insights - Tue, Nov 3, 2026 1:48 PM". Without this the sheet named
// itself after its first column (Alerts read "First Name").
function crumbTitle(doc) {
  const crumb = qs(doc, '.ReportBreadcrumb');
  if (!crumb) return '';
  const named = crumb.querySelector('span[style]') || crumb.lastElementChild || crumb;
  return textOf(named)
    .replace(/\s+[-–]\s+(?=[A-Z][a-z]{2},\s).*$/, '')
    .trim();
}

function previousHeading(table, root) {
  let node = table.previousElementSibling;
  let hops = 0;
  while (node && hops < 4) {
    if (node.matches && node.matches(SECTION)) return textOf(node);
    const inner = node.querySelector && node.querySelector(SECTION);
    if (inner) return textOf(inner);
    node = node.previousElementSibling;
    hops += 1;
  }
  // A heading the page does not class: read the words above the table.
  return labelAbove(table);
}
