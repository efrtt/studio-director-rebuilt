// Record editor adapter.
//
// Confirmed from complete dumps of page=EditFamily and page=EditStudent: the
// editor is a `table.Form` beside the list panel, one row per field:
//
//   table.Form > tr > td     the label ("Guardian", "State", ...)
//                    > td     one or more controls (input / select / textarea)
//
// `NewClass` uses `table.FormEx` with the same row shape, so both table classes
// are accepted. The EditClass dump was cut off before the content root, so that
// page is unverified: it is only taken over if a table of this shape is actually
// present, and otherwise it is left to the app.
//
// Radios are read as a group, as of the rebuild: this reader used to skip every
// radio input outright (`IGNORE_TYPES` held 'radio'), so a record form with a
// radio pair lost the setting silently while the settings reader read the same
// shape correctly. The choice is one value written to the set (see
// model/diff.js), never to whichever input came first.
//
// Nothing here submits anything. Values are written back into the app's own
// controls and its own Save link is clicked — see save.js.

import { qs, qsa, textOf, titledTextOf } from './shell.js';
import { readTable } from '../model/table.js';
import { contentRoot } from '../model/root.js';
import { coverageOf } from '../model/coverage.js';
// The row judgement — which tables are the form, which rows are field rows,
// which controls belong to which row — is shared with every form-shaped reader.
import { formTablesIn, rowsOf, fieldsOfRows } from '../model/rows.js';

// Tables that are structure rather than content: the form itself, the layout
// table the app wraps whole screens in, the weekday checkbox grid, the calendar
// grids. Everything else beside a form is a list the page is showing.
const NOT_DATA = /^(Form|FormEx|Layout|WeekdayCheckboxes|TimeBlock|WeekCal|MonthCal)$/i;

// Where a table's own heading sits: `<div class="formTitle">Existing Season
// Dates</div><table class="SimpleSD">` is the shape on the seasons page.
const HEADING = '.formTitle, .ReportTableSubtitle, .sectionHeader, .sectionTitle, h2, h3, h4';

// Tables that sit *beside* a form, which the editor used to drop.
//
// `NewEditArchive(content=SeasonContent)` is the shape: its `.contentInfo` holds
// `table.Layout`, and that layout table has the season form in one cell and, in
// the other, "Existing Season Dates" — every season with a link to open it.
// Reading only the form left the rebuilt page with a season to edit and no sign
// of the seasons that exist, which is half the screen.
//
// A table is taken when it is a real data table (headings and at least one row),
// is not nested inside another table's cell, and is not one of the places that
// has its own reader: a tab panel, the record list, the button bar, the rail.
function headingFor(table) {
  let node = table.previousElementSibling;
  let hops = 0;
  while (node && hops < 3) {
    if (node.matches && node.matches(HEADING)) return textOf(node);
    const inner = node.querySelector && node.querySelector(HEADING);
    if (inner) return textOf(inner);
    node = node.previousElementSibling;
    hops += 1;
  }
  return '';
}

// Two shapes count as a table beside a form:
//   - a grid: column headings and at least one row ("Existing Season Dates");
//   - a one-column list of links ("Existing Class Locations" on `NewEditDel`,
//     which has no heading row at all — just a link per location).
// Anything else is a spacer, an empty grid, or a two-column label/value block,
// which is a form or another reader's business.
function isSideTable(read) {
  if (!read.rowTotal) return false;
  if (read.headings.length >= 2) return true;
  // One column is enough when its cells are records. Two shapes are real:
  //   - "Existing Vendors" prints one heading ("Vendor") over a link per vendor;
  //   - "Existing Class Locations" prints no heading at all, just a link per
  //     location.
  // The heading used to be a refusal, which dropped the vendor list from the
  // page entirely: the form rendered and the list it manages never appeared.
  if (read.headings.length > 1) return false;
  return read.rows.every((row) => row.length === 1)
    && read.rows.some((row) => row[0] && row[0].href);
}

function tablesBeside(doc, formTables) {
  const root = contentRoot(doc);
  if (!root) return [];
  const skip = new Set(Array.isArray(formTables) ? formTables : [formTables]);

  const tables = [];
  for (const table of qsa(root, 'table')) {
    if (skip.has(table)) continue;
    // A table inside another table's cell is that table's cell content.
    if (table.closest && table.closest('table') !== table) continue;
    if (table.closest && table.closest('.tabContent, .menu, .ButtonBar, #sideNavBar, .List')) continue;
    if (NOT_DATA.test(String(table.getAttribute('class') || '').trim())) continue;

    const read = readTable(table);
    if (!isSideTable(read)) continue;
    tables.push({ ...read, section: headingFor(table) });
  }
  return tables;
}

// The editor is the page, read row by row.
//
// There is no contest and no floor. It used to be a contest — group the page's
// form tables, then take the group with the most fields — and two shipped bugs
// came out of it: a screen printed as two one-row tables lost the smaller one,
// and a page whose editor is spread across parents lost everything but the
// biggest part. Each was patched by adding a condition to the contest (same
// parent, one row, a Save on the page), which is three guesses stacked up to
// recover one fact the page states plainly.
//
// What replaced it was still a ranking, for pages with no Save: the largest
// single form table, with a four-field floor to keep a list page's stub out.
// That is the last of the size contest, and it has the same defect in a quieter
// form — a report whose filters are printed as two tables shows one, a settings
// page whose two controls sit in a small table is "too small to be a form", and
// which table wins is decided by a number the reader cannot explain. It is gone.
//
// So the rule is the page, not a score: every `table.Form`/`FormEx` the page is
// showing inside its content root is read, in document order, and every labelled
// row becomes a row of it. Which rows are field rows, and which controls belong to
// which row, is `model/rows.js` — the same judgement the report, task, settings
// and record readers use. Whether the page is an *editor* is a separate fact,
// `pageSave`, and it belongs to the caller (`recordModel`); a page with a form
// table and no Save is a report's filters or a task's fields, which is what those
// readers ask about it.
//
// There is no floor either — `NewEditDel` is a location name and a link, and a
// report's two-filter form is a form.
export function readForm(doc) {
  const root = contentRoot(doc);
  if (!root) return null;

  // Every table the page is showing, and rows inside each one stand on their
  // own: a table the page itself calls hidden (`table-hidden`) is storage, not
  // part of the editor, and a row with no label is the record's key rather than
  // a field. Both are the page's own statements, not a size guess.
  const chosen = formTablesIn(doc, root);

  if (!chosen.length) return null;

  const rows = [];
  const shown = [];
  const passed = [];
  for (const table of chosen) {
    const one = rowsOf(table);
    rows.push(...one.rows);
    shown.push(...one.shown);
    passed.push(...one.passed);
  }

  const fields = fieldsOfRows(rows);
  if (!fields.length) return null;

  const beside = tablesBeside(doc, chosen);

  // What the page has that this editor does not draw. It is the check that would
  // have caught the two-date page: reading only the biggest form table left three
  // selects unaccounted for, which is a fact the screen can state instead of
  // looking finished. Absent when there is nothing to report, so a complete read
  // adds nothing to the model (and nothing to a golden).
  const unread = coverageOf(root, shown, passed);

  return {
    kind: 'form',
    // The div can hold a warning block and the page's name after it; the name is
    // what a title means. See `titledTextOf`.
    title: titledTextOf(qs(doc, '.formTitle')) || 'Edit',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    rows,
    fields,
    // Other tables on the page — the seasons list beside its editor. Only when
    // the page has one, so a plain editor's model is exactly what it was.
    ...(beside.length ? { tables: beside } : {}),
    ...(unread.length ? { unread } : {})
  };
}

// Does this page carry a form of the editor's shape?
//
// This is about the page, not about whether the page is an editor: that is
// `pageSave` plus a form, which `recordModel` asks. Kept separate because the
// mount path uses the answer to decide whether the live tree can be read where
// it stands instead of paying a GET, and a report's filters are just as real a
// page as a record.
//
// The editor arrives server-rendered, so the page can be read where it stands
// and the copy fetched only when there is no form: one request less, and the
// tree that is read is the tree the edits are written into.
//
// Do not expect this to change a field count. EditFamily reports 19 fields
// because it has 19 editable controls: its three phone-type values arrive as
// `input[type=hidden]`, which this reader drops. The live page said so row by
// row; see the note in docs/rebuild-plan.md.
export function hasForm(doc) {
  return !!readForm(doc);
}
