/*
 * One page, every reader: the content root decides the page, each row decides
 * itself.
 *
 * `content-root.test.mjs` pins that rule for the editor. This file asks the same
 * question of the other readers on the *same* fixture, because a page shape
 * understood by one reader and not by the others is how the rebuild ends up
 * disagreeing with itself: the editor reads the small declared form, the sheet
 * reads the roster above it, the list reads the panel beside it, and the record
 * list reads the rows of the table the sheet just read.
 *
 * The fixture is built to disagree with every cheap rule:
 *
 *   - the biggest table on the document is outside the content root, and it has
 *     more rows than any table inside it;
 *   - the biggest table *inside* the root is a roster above the editor, so
 *     "the first table" and "the biggest table" both point at records;
 *   - the biggest record panel is outside the root and has twenty rows, while
 *     the panel this page is actually showing has two and says "Search
 *     Results", so a size rule and a position rule both pick wrong;
 *   - one panel row is blank, so a reader that copies whole panel contents
 *     instead of judging each row carries an empty line.
 *
 * Assertions are on readings — table ids, row kinds, labels, items — never on a
 * score, because there is no score on this path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;

const { pageRegions, editorRegions, dataRegions } = await import('../src/model/regions.js');
const { contentRoot } = await import('../src/model/root.js');
const { readForm } = await import('../src/lib/form.js');
const { readSheet } = await import('../src/lib/sheet.js');
const { readList } = await import('../src/lib/list.js');
const { recordsOf } = await import('../src/lib/records.js');

const docOf = (html) => new DOMParser().parseFromString('<!doctype html><html><body>' + html + '</body></html>', 'text/html');

const fieldRow = (label, name) => `<tr><td>${label}</td><td><input name="${name}" value="x"></td></tr>`;
const form = (id, rows) => `<table class="Form" id="${id}">${rows.join('')}</table>`;

// A record grid: a heading row and one row per record, each naming its record
// with the app's own link shape (same page, one more parameter).
const roster = (id, names, page) => '<table class="SimpleSD" id="' + id + '"><tr><th>Student</th><th>Class</th></tr>'
  + names.map((name, i) => `<tr><td><a href="?page=${page}&cident=${i + 1}">${name}</a></td><td>Ballet</td></tr>`).join('')
  + '</table>';

const item = (label, href) => `<div class="searchResultItem"><a href="${href}">${label}</a></div>`;
const panel = (id, heading, items) => '<span id="' + id + '" class="searchResultPanel"><div class="searchResultBar">'
  + `<span class="searchResultLabel">${heading}</span></div>`
  + '<div class="searchResultList">' + items.join('') + '</div></span>';

const URL = 'https://app.thestudiodirector.com/srvda/admin.sd?page=ClassRoster';
const INSIDE = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const OUTSIDE = Array.from({ length: 12 }, (_, i) => 'O' + (i + 1));

const page = docOf(
  '<div id="mainContent"><div class="contentContainer"><div class="Content">'
  + '<h1 class="formTitle">Season</h1>'
  // The biggest table inside the root, and it sits above the editor.
  + roster('tbl-roster', INSIDE, 'ClassRoster')
  // The editor: declared, smaller, and below the roster.
  + form('tbl-editor', [fieldRow('Season', 'season'), fieldRow('Amount', 'amount')])
  // The panel this page is showing, named by its own heading.
  + panel('insidePanel', 'Search Results', [
    item('Family: A', '?page=ClassRoster&cident=1'),
    // A blank slot row: a reader that copies panel contents keeps it.
    '<div class="searchResultItem"></div>',
    item('Family: B', '?page=ClassRoster&cident=2')
  ])
  + '</div></div></div>'
  + '<div id="sidePanel">'
  // Bigger than the editor, and not part of this page.
  + form('tbl-outside-form', ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => fieldRow(n, n.toLowerCase())))
  // The biggest table on the document, and not part of this page.
  + roster('tbl-outside-data', OUTSIDE, 'ClassRoster')
  // The biggest record panel, and not the result set this page shows.
  + panel('outsidePanel', 'Families', OUTSIDE.map((n) => item('Family: ' + n, '?page=ClassRoster&cident=' + n)))
  + '</div>'
);

const rowTotal = (doc, id) => doc.getElementById(id).querySelectorAll('tr').length;
const tableIds = (doc) => Array.from(doc.querySelectorAll('table')).map((table) => table.id);

test('the editor is the content root\'s declared form, judged row by row', () => {
  const root = contentRoot(page);
  assert.ok(root && root.classList.contains('contentContainer'), 'the root is the page\'s own statement');

  // Record the numbers the old contest would have used, so a regression cannot
  // pass by the fixture quietly becoming convenient.
  assert.equal(rowTotal(page, 'tbl-outside-data'), 13, 'the fixture must put the biggest table outside the root');
  assert.equal(rowTotal(page, 'tbl-roster'), 9, 'the fixture must put a bigger table above the editor');
  assert.equal(rowTotal(page, 'tbl-editor'), 2, 'the editor is the smallest table in its own root');
  assert.equal(rowTotal(page, 'tbl-outside-form'), 7, 'the outside form is bigger than the editor');

  const chosen = editorRegions(page, root).map((table) => table.id);
  assert.deepEqual(chosen, ['tbl-editor'], 'only the declared form inside the root is the editor');

  const model = readForm(page);
  assert.equal(model.fields.length, 2, 'both declared rows are read');
  assert.deepEqual(model.rows.map((row) => row.label), ['Season', 'Amount']);
});

test('the sheet reader reads every record table in the root and none outside it', () => {
  const sheet = readSheet(page);
  assert.ok(sheet, 'the roster makes this a table screen');
  assert.equal(sheet.tables.length, 1, 'one record grid is inside the root');
  assert.equal(sheet.rows, INSIDE.length, 'all of its rows are read, not a window of them');

  // The grid inside the root is the page's; the identical, bigger one outside is
  // not, so its headings never reach the reading.
  const cells = sheet.tables[0].headings.join(' ');
  assert.match(cells, /Student/);
  assert.ok(!JSON.stringify(sheet.tables).includes('O1'), 'a table outside the root contributes nothing');

  // The reader's table choice is the shared region judgement, not its own.
  assert.deepEqual(dataRegions(page).map((entry) => entry.table.id), ['tbl-roster']);
  assert.ok(
    pageRegions(page).tables.every((entry) => entry.table.closest('.contentContainer')),
    'no region of the page comes from outside the root'
  );
});

test('the list reader picks the panel by what it says, not by size or position', () => {
  const list = readList(page);
  assert.ok(list, 'the panel makes this a list page');

  // Size and position both point at the outside panel; its rows are the record
  // set of a screen this one is not.
  assert.equal(page.querySelectorAll('#outsidePanel .searchResultItem').length, OUTSIDE.length);
  assert.ok(OUTSIDE.length > 3, 'the fixture must make the outside panel the bigger one');
  assert.equal(page.querySelectorAll('#insidePanel .searchResultItem').length, 3);

  assert.equal(list.label, 'Search Results', 'the reading is named by the chosen panel');
  assert.deepEqual(list.items.map((entry) => entry.label), ['A', 'B'], 'the blank slot row is noise, not a record');
  assert.equal(list.items.length, 2, 'no item leaks in from the panel outside the root');

  // The panel it chose is the one inside the content root.
  assert.ok(
    page.getElementById('insidePanel').closest('.contentContainer'),
    'the result set the page shows lives in its root'
  );
});

test('the record list reads the rows the detail reader just read', () => {
  const sheet = readSheet(page);
  const found = recordsOf(sheet, URL);
  assert.ok(found, 'a row that links back to this page with an id is a record');
  assert.equal(found.rows.length, INSIDE.length, 'every record row is read, each from its own cells');
  assert.deepEqual(found.rows.map((row) => row.label).slice(0, 2), ['A', 'B']);
  assert.equal(found.rows[0].id, '1', 'the id comes from the row\'s own link');

  // Nothing outside the root can become a record row, whatever its size.
  assert.ok(!found.rows.some((row) => /^O\d/.test(row.label)));
});
