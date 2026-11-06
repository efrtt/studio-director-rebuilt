/*
 * The content root, judged row by row — and never by size.
 *
 * `readForm` used to pick its editor by a contest: group the page's form tables,
 * take the group with the most fields, rank the survivors. The rule that
 * replaced it is that the page says which tables are forms and every row says
 * what it is; nothing is decided by a number of rows.
 *
 * Every captured page and every live page has agreed with the reference build
 * since that change, which is good news but proves nothing about *this* rule:
 * on those pages the biggest table and the editor happen to be the same one.
 * So these documents are built to disagree on purpose:
 *
 *   1. the biggest table is a roster, and the editor is the smaller form;
 *   2. the biggest *form* is a filter block, and both forms are the editor
 *      because both are declared and both have field rows — a size contest would
 *      silently drop one of them;
 *   3. the biggest form on the document sits outside the content root, so it is
 *      not part of the page at all;
 *   4. a layout wrapper holds the records, and the wrapper is not the records.
 *
 * The assertions are on the reading a reader sees — regions, table kinds, row
 * kinds, field labels — never on a scoring variable, because there is no score.
 * If a size-based rule is ever put back anywhere on this path, at least one of
 * these goes red: verified by temporarily ranking the declared tables by row
 * count, and by temporarily letting `tablesIn` ignore the content root.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;

const { pageRegions, editorRegions, tableKind, kindsOf } = await import('../src/model/regions.js');
const { contentRoot } = await import('../src/model/root.js');
const { readForm } = await import('../src/lib/form.js');

const docOf = (html) => new DOMParser().parseFromString('<!doctype html><html><body>' + html + '</body></html>', 'text/html');

// A declared form row: a label cell and a control cell.
const fieldRow = (label, name) => `<tr><td>${label}</td><td><input name="${name}" value="x"></td></tr>`;
const form = (id, rows) => `<table class="Form" id="${id}">${rows.join('')}</table>`;

// A roster: a heading row and one row per record, no controls at all.
const roster = (id, records) => `<table class="SimpleSD" id="${id}"><tr><th>Student</th><th>Class</th><th>Status</th></tr>`
  + records.map((name) => `<tr><td>${name}</td><td>Ballet</td><td>Enrolled</td></tr>`).join('')
  + '</table>';

// The biggest table on a document, by row count — the number the old contest
// would have used, computed here only so the test can say it decided nothing.
const rowsOf = (doc, id) => doc.getElementById(id).querySelectorAll('tr').length;
const biggest = (doc) => {
  let best = null;
  for (const table of doc.querySelectorAll('table')) {
    if (!best || table.querySelectorAll('tr').length > best.querySelectorAll('tr').length) best = table;
  }
  return best;
};

test('a declared form is the editor even when a bigger table sits above it', () => {
  // The roster is the largest table (9 rows) and the filters block is the
  // largest *form* (5 field rows). Neither is what decides: both declared forms
  // are read, in document order, and the roster is records.
  const doc = docOf(
    '<div id="mainContent">'
    + roster('tbl-roster', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    + form('tbl-filters', [
      fieldRow('Season', 'season'),
      fieldRow('Class type', 'type'),
      fieldRow('Day', 'day'),
      fieldRow('Level', 'level'),
      fieldRow('Instructor', 'instructor')
    ])
    + form('tbl-editor', [fieldRow('Family', 'family'), fieldRow('Amount', 'amount')])
    + '</div>'
  );
  const root = contentRoot(doc);
  const page = pageRegions(doc);

  assert.equal(biggest(doc).id, 'tbl-roster', 'the fixture must make the roster the biggest table, or it proves nothing');
  assert.equal(rowsOf(doc, 'tbl-roster'), 9);
  assert.equal(rowsOf(doc, 'tbl-editor'), 2, 'the editor is the smallest form here');

  const kindOf = (id) => page.tables.find((entry) => entry.table.id === id).kind;
  assert.equal(kindOf('tbl-roster'), 'data', 'a heading row and repeated value rows are records');
  assert.equal(kindOf('tbl-filters'), 'form');
  assert.equal(kindOf('tbl-editor'), 'form');
  assert.equal(page.counts.data, 1, 'exactly the roster is records');
  assert.equal(page.counts.form, 2, 'both declared forms are forms');

  const chosen = editorRegions(doc, root).map((table) => table.id);
  assert.deepEqual(chosen, ['tbl-filters', 'tbl-editor'], 'every declared form with field rows is the editor, in document order');
  assert.ok(!chosen.includes('tbl-roster'), 'the biggest table is not the editor');

  // The reading the editor view renders: all seven labelled rows, filters first.
  const model = readForm(doc);
  assert.equal(model.fields.length, 7, 'no declared form is dropped for being smaller');
  assert.deepEqual(model.rows.map((row) => row.label), ['Season', 'Class type', 'Day', 'Level', 'Instructor', 'Family', 'Amount']);
  assert.equal(model.rows[0].fields[0].name, 'season');
  assert.equal(model.rows[6].fields[0].name, 'amount');
});

test('a bigger form outside the content root is not part of the page', () => {
  // `#tbl-outside` is the biggest form on the document (7 field rows) and is not
  // inside `#mainContent`. The page's editor is the one-row form inside it: the
  // content root is the page's own statement, and size cannot overrule it.
  const doc = docOf(
    '<div id="mainContent">'
    + form('tbl-inside', [fieldRow('Guardian', 'guardian')])
    + '</div>'
    + '<div id="sidePanel">'
    + form('tbl-outside', [
      fieldRow('A', 'a'),
      fieldRow('B', 'b'),
      fieldRow('C', 'c'),
      fieldRow('D', 'd'),
      fieldRow('E', 'e'),
      fieldRow('F', 'f'),
      fieldRow('G', 'g')
    ])
    + '</div>'
  );
  const root = contentRoot(doc);

  assert.equal(root.id, 'mainContent');
  assert.equal(biggest(doc).id, 'tbl-outside', 'the fixture must make the outside form the biggest table');
  assert.equal(rowsOf(doc, 'tbl-outside'), 7);

  const divisions = editorRegions(doc, root).map((table) => table.id);
  assert.deepEqual(divisions, ['tbl-inside'], 'only the content root is read');
  assert.ok(!pageRegions(doc).tables.some((entry) => entry.table.id === 'tbl-outside'), 'a table outside the root is not a region of the page');

  const model = readForm(doc);
  assert.equal(model.fields.length, 1);
  assert.equal(model.fields[0].name, 'guardian');
});

test('the records are the table whose rows are records, not the layout wrapper around them', () => {
  // The wrapper is the table a size contest would have taken whole: it holds the
  // only rows the page's own markup gives it plus the real table inside. Its own
  // framing rows are not records, so it is not a region to read; the roster
  // inside it is.
  const doc = docOf(
    '<div id="mainContent">'
    + '<table class="Layout" id="tbl-layout"><tr><td>'
    + roster('tbl-roster', ['A', 'B', 'C'])
    + '</td><td>' + form('tbl-editor', [fieldRow('Family', 'family')]) + '</td></tr></table>'
    + '</div>'
  );
  const root = contentRoot(doc);
  const page = pageRegions(doc);
  const kindOf = (id) => page.tables.find((entry) => entry.table.id === id).kind;

  assert.equal(kindOf('tbl-layout'), 'noise', 'a table wrapping other tables is layout, not content');
  assert.equal(kindOf('tbl-roster'), 'data', 'the inner table is what the page is showing');
  assert.equal(kindOf('tbl-editor'), 'form');
  assert.equal(page.counts.data, 1);
  assert.equal(page.counts.form, 1);

  // Row kinds, on the table that is actually read.
  const rosterRows = kindsOf(doc.getElementById('tbl-roster'));
  assert.equal(rosterRows[0].kind, 'section', 'a heading row is a band, not a record');
  assert.ok(rosterRows.slice(1).every((row) => row.kind === 'repeated'), 'each value row is a record');
  assert.equal(kindsOf(doc.getElementById('tbl-editor'))[0].kind, 'field');

  assert.deepEqual(editorRegions(doc, root).map((table) => table.id), ['tbl-editor']);
  const model = readForm(doc);
  assert.equal(model.fields.length, 1);
  // The row is named by its label cell; a field's own `label` stays unset here
  // because the row it belongs to is what names it (the editor's view uses the
  // row), so the assertion is on the row.
  assert.equal(model.rows[0].label, 'Family');
  assert.equal(model.fields[0].name, 'family');
  // The roster beside the form is the task/editor view's side list, read from
  // the same judgement: one data table, sectioned by whatever heading it had.
  assert.equal((model.tables || []).length, 1);
  assert.equal(tableKind(doc.getElementById('tbl-roster')), 'data');
});
