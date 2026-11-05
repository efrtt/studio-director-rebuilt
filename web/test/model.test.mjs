// The shared model, tested where it had no tests before.
//
// Three of these cover blind spots the rebuild named: a record form with radios
// used to drop them, a save used to report success while a field had not been
// written, and the weekday bitmask existed twice with two different regexes.
//
// Note the `valuesFor` helper: the diff treats an absent key as "empty", so a
// test that passes only the field it is changing is also asking for every other
// field to be cleared. Every case here starts from the form's own values.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser } from 'linkedom';

import { contentRoot, CHROME } from '../src/model/root.js';
import { weekdayOf, WEEKDAY } from '../src/model/fields.js';
import { readForm } from '../src/lib/form.js';
import { diffFields, applyFields, changesFrom } from '../src/model/diff.js';
import { saveInApp } from '../src/lib/save.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

// Every field at its current value, then the edits on top.
function valuesFor(form, edits = {}) {
  const values = {};
  for (const field of form.fields) {
    values[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }
  return { ...values, ...edits };
}

test('the content root is one definition, with the shell fallbacks in order', () => {
  const both = doc('<body><div class="contentContainer"><p>a</p></div><div id="mainContent"><p>b</p></div></body>');
  assert.equal(contentRoot(both).getAttribute('class'), 'contentContainer');

  const mainOnly = doc('<body><div id="mainContent"><p>b</p></div></body>');
  assert.equal(contentRoot(mainOnly).getAttribute('id'), 'mainContent');

  const print = doc('<body><p>bare</p></body>');
  assert.equal(contentRoot(print).tagName, 'BODY');

  // The overlay's own buttons are chrome on every screen that presses anything.
  assert.match(CHROME, /#sd-root/);
  assert.match(CHROME, /#sideNavBar/);
});

test('the weekday bitmask keeps the app\'s bit order', () => {
  assert.equal(weekdayOf('day__1'), 'Sun');
  assert.equal(weekdayOf('day__2'), 'Mon');
  assert.equal(weekdayOf('day__64'), 'Sat');
  // The reports prefix the same ids with their own subject.
  assert.equal(weekdayOf('classes_day__4'), 'Tue');
  assert.equal(weekdayOf('students_day__8'), 'Wed');
  assert.equal(weekdayOf('day__128'), null);
  assert.equal(weekdayOf('name'), null);
  assert.equal(Object.keys(WEEKDAY).length, 7);
});

const RADIO_FORM = `
<body><div class="contentContainer">
  <div class="formTitle">Edit Student</div>
  <table class="Form">
    <tr><td>Name</td><td><input id="name" value="Ada"></td></tr>
    <tr><td>Kind</td><td>
      <input type="radio" name="kind" id="kind_a" value="A" checked>
      <input type="radio" name="kind" id="kind_b" value="B">
    </td></tr>
    <tr><td>State</td><td><select id="state"><option value="CA" selected>CA</option><option value="NY">NY</option></select></td></tr>
    <tr><td>Notes</td><td><textarea id="notes">hi</textarea></td></tr>
    <tr><td>Zip</td><td><input id="zip" value="90210"></td></tr>
  </table>
  <a id="save" href="#">Save</a>
</div></body>`;

test('a record form with radios keeps them, as one field per group', () => {
  const d = doc(RADIO_FORM);
  const form = readForm(d);
  assert.ok(form, 'the form is read');

  const radio = form.fields.find((f) => f.type === 'radio');
  assert.ok(radio, 'the radio pair is a field, not silently dropped');
  assert.equal(radio.key, 'radio:kind');
  assert.equal(radio.selector, '[name="kind"]');
  assert.equal(radio.value, 'A');
  assert.equal(radio.options.length, 2);
  // And it did not become two text fields.
  assert.equal(form.fields.filter((f) => f.name === 'kind').length, 1);
});

// The app ends some editors with its own key: measured live, EditClass ships
// <tr><td></td><td><input id="cident" value="1782…"></td></tr> and the inventory
// item editor the same with `item_id`.
const ID_ROW_FORM = `
<body><div class="contentContainer">
  <div class="formTitle">Edit Item</div>
  <table class="FormEx"><tbody>
    <tr><td>Item / Style</td><td><input id="item_style" value="Leotard"></td></tr>
    <tr><td>Color</td><td><select id="color"><option>Black</option></select></td></tr>
    <tr><td>Deposit</td><td><input id="deposit" value="0"></td></tr>
    <tr><td>Gender</td><td><select id="gender"><option value="both">Either</option></select></td></tr>
    <tr><td></td><td><input id="item_id" type="text" value="1792595222235"></td></tr>
  </tbody></table>
  <a id="save" href="#submit">Save</a>
</div></body>`;

test('the app\'s own record id in an unlabelled row is not a field', () => {
  const d = doc(ID_ROW_FORM);
  const form = readForm(d);
  assert.ok(form, 'the form is still read');

  // The bare number under the last field was this row; it has no label, so it
  // cannot be presented, and it is a key rather than something to fill in.
  assert.deepEqual(form.fields.map((f) => f.key), ['item_style', 'color', 'deposit', 'gender']);
  assert.equal(form.rows.length, 4);
  // Leaving it out of the model does not remove it from the page: the app's own
  // Save still carries the id it shipped.
  assert.equal(d.getElementById('item_id').getAttribute('value'), '1792595222235');

  const changes = changesFrom(form, valuesFor(form, { deposit: '25' }));
  assert.deepEqual(changes.map((c) => c.key), ['deposit']);
});

// The seasons page is a form and a table side by side: `table.Layout` holds the
// season form in one cell and "Existing Season Dates" in the other.
const SEASON_FIXTURE = new URL('./fixtures/editor-season.html', import.meta.url);

test('a table beside the form is read, not dropped', () => {
  const d = doc(fs.readFileSync(SEASON_FIXTURE, 'utf8'));
  const form = readForm(d);
  assert.ok(form, 'the form is still read');
  assert.deepEqual(form.fields.slice(0, 3).map((f) => f.key), ['season_name', 'start_month', 'start_day']);

  // The seasons list beside it used to be lost entirely.
  assert.equal(form.tables.length, 1);
  const [list] = form.tables;
  assert.equal(list.section, 'Existing Season Dates');
  assert.equal(list.headings[0], 'Season Name');
  assert.equal(list.headings.length, 9);
  assert.equal(list.rowTotal, 2);
  // Its first column is how you open another season, so it stays a link.
  assert.match(list.rows[1][0].href, /season_ident=102/);
  assert.equal(list.rows[1][0].text, '2027 Sign Ups');
});

test('the tables that are structure are not printed as data', () => {
  // `table.Layout` wraps the whole screen and `table.Form` is the form itself;
  // neither is a list, and neither may turn up under the fields.
  const form = readForm(doc(fs.readFileSync(SEASON_FIXTURE, 'utf8')));
  assert.ok(form.tables.every((t) => !/^(Layout|Form|FormEx)$/.test(t.cls)));
});

// Two fields is a whole editor when the page says so: `NewEditDel` is a location
// name and a link, and the four-control floor read the page as not-an-editor.
const LOCATIONS_FIXTURE = new URL('./fixtures/editor-locations.html', import.meta.url);

test('a page carrying Save is an editor however few fields it has', () => {
  const form = readForm(doc(fs.readFileSync(LOCATIONS_FIXTURE, 'utf8')));
  assert.ok(form, 'the locations editor is read');
  assert.deepEqual(form.fields.map((f) => f.key), ['name', 'url']);
  // The record id sits in a hidden input inside a hidden row: never a field.
  assert.ok(form.fields.every((f) => f.name !== 'lident'));
});

test('a one-column list of links beside the form is read too', () => {
  const form = readForm(doc(fs.readFileSync(LOCATIONS_FIXTURE, 'utf8')));
  assert.equal(form.tables.length, 1);
  const [list] = form.tables;
  assert.equal(list.section, 'Existing Class Locations');
  // No heading row at all on the live page — the links are the table.
  assert.equal(list.headings.length, 0);
  assert.equal(list.rowTotal, 4);
  assert.equal(list.rows[1][0].text, 'Downtown');
  assert.match(list.rows[1][0].href, /lident=101/);
});

test('a page without Save reads its form; being an editor is a separate fact', async () => {
  // This used to assert a four-field floor, which is how a list page's three
  // control stub was "not a form at all". The floor belonged to the size contest
  // that picked an editor's biggest table: with the page read row by row, the
  // shape is the table and being an *editor* is the page having its own Save.
  const stub = doc(`
    <body><div class="contentContainer"><div class="formTitle">Classes</div>
      <table class="Form">
        <tr><td>Filter</td><td><input id="a" value=""></td></tr>
        <tr><td>Season</td><td><select id="b"><option>1</option></select></td></tr>
        <tr><td>Date</td><td><input id="c" value=""></td></tr>
      </table>
    </div></body>`);
  const form = readForm(stub);
  assert.equal(form.rows.length, 3, 'three labelled rows are three rows, however few');
  assert.deepEqual(form.fields.map((f) => f.key), ['a', 'b', 'c']);

  const { recordModel } = await import('../src/lib/record.js');
  assert.equal(recordModel(stub, 'https://x.test/admin.sd?page=Classes'), null,
    'no Save, so a form it may be, an editor it is not');
});

test('a radio choice is written to the set, not to the first input', () => {
  const d = doc(RADIO_FORM);
  const form = readForm(d);

  const changes = diffFields(form.fields, valuesFor(form, { 'radio:kind': 'B' }));
  assert.equal(changes.length, 1);
  assert.equal(changes[0].radio, true);

  const { applied, missing } = applyFields(d, changes);
  assert.deepEqual(missing, []);
  assert.deepEqual(applied, ['radio:kind']);
  assert.equal(d.querySelector('#kind_b').hasAttribute('checked'), true);
  assert.equal(d.querySelector('#kind_a').hasAttribute('checked'), false);
});

test('an unchanged radio group is not a change', () => {
  const d = doc(RADIO_FORM);
  const form = readForm(d);
  // No value for the group at all: "not edited", not "clear the choice".
  const values = valuesFor(form);
  delete values['radio:kind'];
  assert.deepEqual(diffFields(form.fields, values), []);
});

test('a field that cannot be written is reported missing, and no save is pressed', () => {
  const d = doc(RADIO_FORM);
  const form = readForm(d);

  // A change whose selector is not on the page: the live DOM did not match what
  // the model was built from.
  const changes = diffFields(form.fields, valuesFor(form, { zip: '00000' })).concat([
    { selector: '#gone', value: 'x', key: 'gone' }
  ]);

  const { applied, missing } = applyFields(d, changes);
  assert.deepEqual(missing, ['gone']);
  assert.deepEqual(applied, ['zip']);

  let clicked = false;
  d.getElementById('save').click = () => { clicked = true; };

  const result = saveInApp(d, changes);
  assert.equal(result.submitted, false);
  assert.equal(result.reason, 'missing');
  assert.deepEqual(result.missing, ['gone']);
  assert.equal(clicked, false, 'the app\'s Save must not be pressed after a partial write');
});

test('a save with every field written still presses the app\'s own Save', () => {
  const d = doc(RADIO_FORM);
  const form = readForm(d);
  const changes = changesFrom(form, valuesFor(form, { zip: '00000' }));

  let clicked = false;
  d.getElementById('save').click = () => { clicked = true; };

  const result = saveInApp(d, changes);
  assert.equal(result.submitted, true);
  assert.equal(result.reason, 'ok');
  assert.deepEqual(result.missing, []);
  assert.equal(clicked, true);
});

test('an unchanged form submits nothing', () => {
  const d = doc(RADIO_FORM);
  const form = readForm(d);
  assert.deepEqual(changesFrom(form, valuesFor(form)), []);

  const result = saveInApp(d, []);
  assert.equal(result.submitted, false);
  assert.equal(result.reason, 'unchanged');
});
