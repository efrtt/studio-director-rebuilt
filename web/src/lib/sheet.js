// Table screens: the largest group the rebuilt UI had not touched.
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
import { readTable } from '../model/table.js';
import { readActions } from './actions.js';
import { contentRoot } from '../model/root.js';
import { TABLE_ROWS } from './thresholds.js';

// Tables that are structure, not data: the weekday checkbox grid inside a form,
// the form itself (label column, control column), and the layout table the app
// wraps whole pages in.
const NOT_DATA = /^(WeekdayCheckboxes|Layout|TimeBlock|WeekCal|MonthCal|Form|FormEx)$/i;

function isDataTable(table) {
  for (const cls of String(table.getAttribute('class') || '').split(/\s+/)) {
    if (NOT_DATA.test(cls)) return false;
  }
  return true;
}

// A heading above a table ("Class Trends") is the table's own section label.
const SECTION = '.WithinSectionSpace, .sectionHeader, .sectionTitle, h2, h3, h4';

export function readSheet(doc) {
  const root = contentRoot(doc);
  if (!root) return null;

  const tables = [];
  let rows = 0;

  for (const table of qsa(root, 'table')) {
    if (table.closest && table.closest('table') !== table) continue;
    if (!isDataTable(table)) continue;

    const read = readTable(table);
    if (!read.headings.length && !read.rows.length) continue;
    // A two-column table with no headings is a form laid out as a table —
    // "label cell, control cell" — which is how several settings pages print
    // themselves. It is not a list of records, and the settings reader is the
    // one that should get it.
    if (!read.headings.length && read.rows.every((row) => row.length <= 2)) continue;

    // The nearest heading before this table, if the page puts one there.
    const heading = previousHeading(table, root);
    tables.push({ ...read, section: heading });
    rows += read.rowTotal != null ? read.rowTotal : read.rows.length;
  }

  if (!tables.length || rows < TABLE_ROWS) return null;

  const actions = readActions(root);

  return {
    kind: 'sheet',
    title: textOf(qs(doc, '.formTitle, .ReportName, h1')) || tables[0].headings[0] || 'Data',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    tables,
    rows,
    // How many rows this view actually carries, when a table was cut short.
    shown: tables.reduce((n, t) => n + t.rows.length, 0),
    truncated: rows > tables.reduce((n, t) => n + t.rows.length, 0),
    actions
  };
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
  return '';
}
