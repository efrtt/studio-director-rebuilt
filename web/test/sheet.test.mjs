/*
 * Table screens.
 *
 * 120 of the crawl's pages are a table with headings and rows and nothing that
 * edits a record: the Home schedule, Trends, Alerts, the size/vendor settings,
 * and every Print sheet. The view is read-only on purpose — it shows the app's
 * own columns and rows, filters them, and leaves running the page to the app.
 *
 * The print fixture is taken from a live dump of PrintClassRoster, which has no
 * shell at all: no form, no rail, no top bar. That is what a print window looks
 * like, and it must not be covered with "no view for this page".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;

const here = path.dirname(fileURLToPath(import.meta.url));
const { parseHtml, hasShell } = await import('../src/lib/shell.js');
const { readSheet } = await import('../src/lib/sheet.js');
const { readPage } = await import('../src/lib/page.js');
const { readTable } = await import('../src/lib/tabs.js');
const { clickActionInApp } = await import('../src/lib/actions.js');
const { cellKind } = await import('../src/lib/cellclass.js');

const load = (name) => parseHtml(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));

const rosterDoc = load('sheet-roster.html');
const sheet = readSheet(rosterDoc);

test('a print window has no shell, and is still a screen', () => {
  assert.equal(hasShell(rosterDoc), false, 'the dumped print page has no #mainContent');
  assert.ok(sheet, 'PrintClassRoster is a table screen');
  assert.equal(sheet.kind, 'sheet');
  assert.equal(sheet.title, 'Class Roster for Junior Tap Company');
  assert.equal(sheet.tables.length, 1, 'the browser extensions contribute nothing');
  assert.deepEqual(sheet.actions, [], 'the page has no control of its own to press');
});

test('two heading rows become a caption and ten columns', () => {
  const table = sheet.tables[0];
  assert.equal(table.cls, 'AttendanceRoster');
  // Without this the view prints one heading ("Current Class Roster") over ten
  // cells, and every column is off by nine.
  assert.equal(table.caption, 'Current Class Roster');
  assert.deepEqual(table.headings, [
    'Student', 'Age', 'Guardian', 'Phone', 'Cell', 'Classes',
    'Fri, Oct 2', 'Fri, Oct 9', 'Fri, Oct 16', 'Fri, Oct 23'
  ]);
  assert.equal(table.rows.length, 3);
  assert.equal(table.rows[0].length, 10);
  assert.equal(table.rows[0][0].text, 'Ada Lovelace');
  assert.equal(table.rows[0][6].text, '', 'a date cell is a checkbox, not text');
  assert.equal(sheet.rows, 3);
});

test('a caption row that comes first is kept as the caption', () => {
  const doc = parseHtml(`<table class="ReportTable"><tbody>
      <tr><th>Families with a balance</th></tr>
      <tr><th>Family</th><th>Balance</th></tr>
      <tr><td>Hopper</td><td>0.00</td></tr>
      <tr><td>Lovelace</td><td>12.00</td></tr>
    </tbody></table>`);
  const table = readTable(doc.querySelector('table'));
  assert.equal(table.caption, 'Families with a balance');
  assert.deepEqual(table.headings, ['Family', 'Balance']);
  assert.equal(table.rows.length, 2);
});

test('a right-aligned column survives a caption row', () => {
  // EditStudent's skills table: `th.AR` on "Signed Off By".
  const doc = parseHtml(`<table class="ReportTable"><tbody>
      <tr><th>Skills</th></tr>
      <tr><th>Level</th><th>Score</th><th class="AR">Signed Off By</th></tr>
      <tr><td>1</td><td>4</td><td class="AR">Robin</td></tr>
    </tbody></table>`);
  const table = readTable(doc.querySelector('table'));
  assert.deepEqual(table.headings, ['Level', 'Score', 'Signed Off By']);
  assert.equal(table.rows[0][2].right, true);
  assert.equal(table.rows[0][1].right, false);
});

test('routing sends a print page to the sheet view', () => {
  const page = readPage(rosterDoc, 'https://app.thestudiodirector.com/studio1/admin.sd?page=PrintClassRoster&cident=77');
  assert.equal(page.view, 'sheet');
  assert.equal(page.title, 'Class Roster for Junior Tap Company');
  assert.deepEqual(page.nav, [], 'a print window carries no rail');
  assert.equal(page.task, null, 'no form, so no task');
  assert.equal(page.index, null);
});

test('a table with a heading above it keeps that heading', () => {
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
      <div class="formTitle">Manage Sizes</div>
      <h3 class="sectionHeader">Sizes</h3>
      <table class="ReportTable"><tr><th>Size</th><th>Sort</th></tr>
        <tr><td><a href="admin.sd?page=ManageSizes&amp;costume_size_ident=3">Child Small</a></td><td>1</td></tr>
        <tr><td><a href="admin.sd?page=ManageSizes&amp;costume_size_ident=4">Child Medium</a></td><td>2</td></tr>
      </table>
    </div></div></form>`);

  const read = readSheet(doc);
  assert.equal(read.tables.length, 1);
  assert.equal(read.tables[0].section, 'Sizes');
  assert.deepEqual(read.tables[0].headings, ['Size', 'Sort']);
  assert.equal(readPage(doc, 'https://x/admin.sd?page=ManageSizes').view, 'sheet');
});

test('the week calendar keeps its own view: TimeBlock tables are not sheets', () => {
  assert.equal(readSheet(load('calendar-page.html')), null);
  assert.equal(readPage(load('calendar-page.html'), 'https://x/admin.sd?page=CalendarPage').view, 'week');
});

test('a report keeps its filters, and a record list stays a list', () => {
  // A report page's result table *is* a table, so the sheet reader can read it;
  // routing tries the report first, which is what keeps the filters in place.
  const report = readPage(load('report-roster.html'), 'https://x/admin.sd?page=ClassRosterForm');
  assert.equal(report.view, 'report');
  assert.equal(report.sheet, null);
  assert.equal(report.task, null);

  assert.equal(readSheet(load('editor-class.html')), null, 'the record panel is a list, not a table');
});

test('a page with one row is not a table screen', () => {
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
      <table class="ReportTable"><tr><th>Size</th></tr><tr><td>Child Small</td></tr></table>
    </div></div></form>`);
  assert.equal(readSheet(doc), null);
});

test('a long table is cut at 300 rows and says how many there are', () => {
  const rows = Array.from({ length: 320 }, (_, i) => `<tr><td>Row ${i}</td></tr>`).join('');
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
      <table class="ReportTable"><tr><th>Name</th></tr>${rows}</table>
    </div></div></form>`);

  const read = readSheet(doc);
  assert.equal(read.tables[0].rows.length, 300);
  assert.equal(read.tables[0].rowTotal, 320);
  assert.equal(read.rows, 320);
  assert.equal(read.shown, 300);
  assert.equal(read.truncated, true);
});

test('a link inside a data row is a row, not a control', () => {
  const withLinks = parseHtml(`<div class="contentContainer"><div class="Content">
      <div class="formTitle">Manage Sizes</div>
      <table class="ReportTable"><tr><th>Size</th></tr>
        <tr><td><a href="admin.sd?page=ManageSizes&amp;costume_size_ident=3">Child Small</a></td></tr>
        <tr><td><a href="admin.sd?page=ManageSizes&amp;costume_size_ident=4">Child Medium</a></td></tr>
      </table>
      <div class="ButtonBar"><a href="#" onclick="StudioDir.onSubmit('Add');return false;">Add Size</a></div>
    </div></div>`);
  const read = readSheet(withLinks);
  assert.deepEqual(read.actions.map((a) => a.label), ['Add Size']);
  assert.equal(read.tables[0].rows[0][0].href, 'admin.sd?page=ManageSizes&costume_size_ident=3');
});

test('pressing the sheet’s control goes through the live page', () => {
  const live = parseHtml(`<div class="contentContainer"><div class="Content">
      <table class="ReportTable"><tr><th>Size</th></tr><tr><td>A</td></tr><tr><td>B</td></tr></table>
      <div class="ButtonBar"><a href="#" id="addsize">Add Size</a></div>
    </div></div>`);
  const read = readSheet(live);

  let clicks = 0;
  live.getElementById('addsize').addEventListener('click', (e) => {
    e.preventDefault();
    clicks += 1;
  });

  const result = clickActionInApp(live, read.actions[0]);
  assert.deepEqual(result, { submitted: true, via: 'id', id: 'addsize' });
  assert.equal(clicks, 1);
});

test('a control that is gone is reported, not silently pressed', () => {
  const result = clickActionInApp(parseHtml('<div></div>'), { label: 'Print', id: '', js: true });
  assert.equal(result.submitted, false);
  assert.equal(result.reason, 'missing');
});

const perf = readSheet(load('sheet-perf.html'));

test('a page with an empty table keeps it, under its own label', () => {
  // PerfCostumeMgmt: "Performance Info" is empty and the costumes below it are
  // not. Dropping the empty one made the costume table look like the whole
  // screen, and both labels were lost because the app writes them as
  // `div.ReportTableSubtitle`, not a heading.
  assert.ok(perf, 'the page is a table screen');
  assert.equal(perf.tables.length, 2);
  const [performance, costume] = perf.tables;
  assert.equal(performance.section, 'Performance Info');
  assert.equal(performance.headings[0], 'Event Name');
  assert.equal(performance.rows.length, 0);
  assert.equal(performance.message, 'No items to display.');
  assert.equal(performance.total, 'Total Performance Fee: 0.00');
  assert.equal(costume.section, 'Costume Info');
  assert.equal(costume.rows.length, 2);
  assert.equal(costume.total, 'Totals: Unit Cost: 0.00 List Price: 0.00 Deposit: 0.00');
});

test('the action bar under a table stays with it, as links', () => {
  // These are the only ways to add a performance or a costume, and they are
  // ordinary links, which the action reader drops on purpose.
  assert.deepEqual(perf.tables[0].links.map((l) => l.label),
    ['Add New Performance', 'Set performing flags by student']);
  assert.match(perf.tables[0].links[0].href, /page=ClassPerformance/);
  assert.deepEqual(perf.tables[1].links.map((l) => l.label),
    ['Add New Costume', 'Enter Student Measurements & Sizes']);
  assert.match(perf.tables[1].links[1].href, /page=MeasurementsByClass/);
  assert.deepEqual(perf.actions, [], 'a link is navigation, not a press');
});

test('the app’s own action column is an action, even when its link navigates', () => {
  // `<td class="action-cell"><a href="admin.sd?page=Unenroll">` — the href is a
  // page, so the cell read as an ordinary link and never got its pill.
  const cell = perf.tables[1].rows[0][10];
  assert.equal(cell.action, true);
  assert.equal(cellKind(cell), 'action');
  assert.deepEqual(cell.actions.map((a) => a.label), ['Copy', 'Remove']);
});

test('a data cell is still a link, not an action', () => {
  const cell = perf.tables[1].rows[0][1];
  assert.equal(cell.action, undefined);
  assert.equal(cellKind(cell), 'link');
});
