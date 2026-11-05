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
import { coverageOf } from '../src/model/coverage.js';
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
  // Passed over on purpose, so coverage does not call it a shortfall.
  assert.equal(form.unread, undefined, 'the id row is a decision, not an omission');
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

test('a page with Save joins its sibling form tables into one editor', () => {
  // Measured live on `page=ChangeEnrollDate` (Enrollment Dates) on 2026-11-05: two
  // one-row `table.Form`s under the same `.contentInfo`, one per date, each three
  // selects (month, day, year) and the hidden field the calendar widget keeps.
  // Reading only the biggest table kept the first date and dropped the second,
  // so the rebuilt page asked for one date where the app asks for two.
  const d = doc(`
    <body><div class="contentContainer"><div class="contentInfo">
      <div class="formTitle">Enrollment Dates</div>
      <p>Charge for classes starting:</p>
      <table class="Form"><tr>
        <td>Charge for classes starting:</td>
        <td>
          <select id="a_mon"><option>Nov</option><option>Dec</option></select>
          <select id="a_day"><option>4</option><option>5</option></select>
          <select id="a_year"><option>2026</option><option>2027</option></select>
          <input type="hidden" id="a_hidden" value="">
        </td>
      </tr></table>
      <p>Display on roster starting:</p>
      <table class="Form"><tr>
        <td>Display on roster starting:</td>
        <td>
          <select id="b_mon"><option>Nov</option></select>
          <select id="b_day"><option>4</option></select>
          <select id="b_year"><option>2026</option></select>
        </td>
      </tr></table>
      <a href="#" id="save">Save</a>
    </div></div></body>`);

  const form = readForm(d);
  assert.ok(form, 'the page is an editor');
  assert.deepEqual(form.rows.map((row) => row.label),
    ['Charge for classes starting:', 'Display on roster starting:']);
  assert.equal(form.fields.length, 6);
  // The hidden date the calendar widget keeps is not a field of its own.
  assert.equal(form.fields.some((field) => /hidden/.test(field.id)), false);
});

test('a page without Save reads its form; it is still not an editor', async () => {
  // This used to assert a four-field floor, so a list page's three-control stub
  // came back as "not a form at all". The floor goes with the rest of the size
  // contest — three labelled rows are three rows — and being an *editor* is a
  // separate fact: the page has its own Save.
  const stub = doc(`
    <body><div class="contentContainer"><div class="formTitle">Classes</div>
      <table class="Form">
        <tr><td>Filter</td><td><input id="a" value=""></td></tr>
        <tr><td>Season</td><td><select id="b"><option>1</option></select></td></tr>
        <tr><td>Date</td><td><input id="c" value=""></td></tr>
      </table>
    </div></body>`);
  const form = readForm(stub);
  assert.ok(form, 'three labelled rows are a form');
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

// ---- coverage: a page cannot be silently half-read ----
//
// The Enrollment Dates page printed its editor as two one-row form tables and the
// reader kept the biggest, so the second date vanished with nothing said. These
// two cases pin the two halves of the answer: fragments that belong together are
// read together, and a control that no reader reached is reported.

test('a page printed as two form tables is one form, with nothing unread', () => {
  const d = doc(`
    <body><div class="contentContainer">
      <div class="formTitle">Enrollment Dates</div>
      <table class="Form"><tr><td>Charge for classes starting:</td><td>
        <select id="charge__mon"><option>Nov</option></select>
        <select id="charge__day"><option>4</option></select>
        <select id="charge__year"><option>2026</option></select>
        <input type="hidden" id="charge__hidden" value="x">
      </td></tr></table>
      <table class="Form"><tr><td>Display on roster starting:</td><td>
        <select id="roster__mon"><option>Nov</option></select>
        <select id="roster__day"><option>4</option></select>
        <select id="roster__year"><option>2026</option></select>
      </td></tr></table>
      <a id="save" href="#">Save</a>
    </div></body>`);
  const form = readForm(d);
  assert.ok(form, 'the editor is read');
  assert.equal(form.fields.length, 6);
  assert.deepEqual(form.fields.map((f) => f.key), [
    'charge__mon', 'charge__day', 'charge__year',
    'roster__mon', 'roster__day', 'roster__year'
  ]);
  // Both dates read, and the hidden calendar value is a control nobody shows on
  // purpose - neither is a shortfall.
  assert.equal(form.unread, undefined, 'nothing was left out');
});

test('an editor is the whole page, not its biggest table', () => {
  // The rule this replaced: group the form tables and keep the group with the
  // most fields. A page printing its editor across two parents lost the smaller
  // half with nothing said. A page carrying its own Save is an editor, so every
  // form table it contains is read, in document order.
  const d = doc(`
    <body><div class="contentContainer">
      <table class="Form">
        <tr><td>Name</td><td><input id="name" value="Ada"></td></tr>
        <tr><td>Zip</td><td><input id="zip" value="90210"></td></tr>
      </table>
      <div class="aside">
        <table class="Form"><tr><td>Note</td><td><input id="aside_note" value="x"></td></tr></table>
      </div>
      <a id="save" href="#">Save</a>
    </div></body>`);
  const form = readForm(d);
  assert.ok(form);
  assert.deepEqual(form.fields.map((f) => f.key), ['name', 'zip', 'aside_note']);
  assert.equal(form.unread, undefined, 'nothing was left out, so nothing to report');
});

test('a control outside any form table is counted as unread', () => {
  // A control the editor does not draw, on a page that says it is an editor.
  // Coverage states the shortfall instead of the screen looking finished.
  const d = doc(`
    <body><div class="contentContainer">
      <table class="Form">
        <tr><td>Name</td><td><input id="name" value="Ada"></td></tr>
        <tr><td>Zip</td><td><input id="zip" value="90210"></td></tr>
      </table>
      <div class="pane"><input id="stray" value="x"></div>
      <a id="save" href="#">Save</a>
    </div></body>`);
  const form = readForm(d);
  assert.ok(form);
  assert.equal(form.unread.length, 1, JSON.stringify(form.unread));
  assert.equal(form.unread[0].id, 'stray');
});

test('an id shared with a button-bar anchor is not the field\u2019s address', () => {
  // Measured on the EditFamily capture: the page prints `<a id="email">Email</a>`
  // in its button bar beside `input#email`. Addressing the field by id made
  // `querySelector('#email')` return the anchor, so a save wrote the value onto an
  // anchor, reported success, and the app submitted what it already had.
  const d = doc(`
    <body>
      <a id="email" href="#">Email</a>
      <div class="contentContainer">
        <table class="Form">
          <tr><td>Email</td><td><input id="email" name="email" value="old@example.test"></td></tr>
          <tr><td>Zip</td><td><input id="zip" name="zip" value="90210"></td></tr>
        </table>
        <a id="save" href="#">Save</a>
      </div>
    </body>`);
  const form = readForm(d);
  const email = form.fields.find((f) => f.name === 'email');
  assert.equal(email.selector, '[name="email"]', 'the shared id is not an address');

  const changes = changesFrom(form, valuesFor(form, { email: 'new@example.test' }));
  const { applied, missing } = applyFields(d, changes);
  assert.deepEqual(missing, []);
  assert.deepEqual(applied, ['email']);
  assert.equal(d.querySelector('input[name="email"]').value, 'new@example.test');
  assert.equal(d.querySelector('a#email').getAttribute('href'), '#');
});

test('a write aimed at something that is not a control is refused', () => {
  // The backstop for the same shape on a page this suite has never seen: a target
  // that is not a control means the field is not there, and the caller is told
  // rather than shown a confirmation for a write that went nowhere.
  const d = doc('<body><a id="email" href="#">Email</a></body>');
  const { applied, missing } = applyFields(d, [{ selector: '#email', value: 'x', key: 'email' }]);
  assert.deepEqual(missing, ['email']);
  assert.deepEqual(applied, []);
});

test('coverage counts only the controls nobody accounted for', () => {
  // The four answers coverage gives, in one page: a shown control, a control that
  // belongs to another reader (the record list's filter), a control the app is not
  // showing, and a posted hidden key. Only the stray one is a shortfall.
  const d = doc(`
    <body><div class="contentContainer">
      <table class="Form"><tr><td>Name</td><td><input id="shown"></td></tr></table>
      <div class="List"><input id="listfilter"></div>
      <table class="Form table-hidden"><tr><td>Hidden</td><td><input id="storage"></td></tr></table>
      <input type="hidden" id="key" value="1">
      <input id="stray">
    </div></body>`);
  const root = d.querySelector('.contentContainer');
  const unread = coverageOf(root, [d.querySelector('#shown')], [d.querySelector('#key')]);
  assert.deepEqual(unread.map((u) => u.id), ['stray']);
  assert.equal(unread[0].type, 'text');
});

test('a page with no Save reads every form table it shows, in document order', async () => {
  // The complement of the old rule. Without a Save the page is not an editor,
  // and the reader used to take its largest form table and leave the rest to
  // "another screen" — which is the size contest in its last disguise, and the
  // reason a report printed as two filter tables showed one. Every form table
  // the page shows is read now; a control the reader still cannot place is what
  // `unread` is for, and here there is none.
  const d = doc(`
    <body><div class="contentContainer">
      <table class="Form">
        <tr><td>Season</td><td><input id="season" value="1"></td></tr>
        <tr><td>Type</td><td><input id="type" value="all"></td></tr>
        <tr><td>Day</td><td><input id="day" value=""></td></tr>
        <tr><td>Level</td><td><input id="level" value=""></td></tr>
      </table>
      <div class="aside">
        <table class="Form"><tr><td>Other</td><td><input id="other" value="x"></td></tr></table>
      </div>
      <a id="runreport" href="#">Run Report</a>
    </div></body>`);
  const form = readForm(d);
  assert.ok(form);
  assert.deepEqual(form.fields.map((f) => f.key), ['season', 'type', 'day', 'level', 'other']);
  assert.equal(form.unread, undefined, 'every control is either shown or knowingly passed');

  const { recordModel } = await import('../src/lib/record.js');
  assert.equal(recordModel(d, 'https://x.test/admin.sd?page=Report'), null,
    'a report\u2019s filters are a form, not an editor');
});

test('the family editor reports the phone-type selects it does not offer', () => {
  // Found by the check itself, on the live-capture fixture: the app prints each
  // phone's type chooser as the row's *label* cell and the number as the value
  // cell, so the editor reads the number and never the type. That is a real gap
  // (you cannot set a number's type here) and it used to be invisible; now the
  // model says which controls it left, and this pins the three by name so losing
  // a fourth is a diff rather than a surprise.
  const html = fs.readFileSync(new URL('./fixtures/editor-family.html', import.meta.url), 'utf8');
  const form = readForm(doc(html));
  assert.ok(form);
  assert.deepEqual((form.unread || []).map((u) => u.name), ['phone1_label', 'phone2_label', 'phone3_label']);
});

test('the record panel beside an editor is not counted against it', () => {
  // The list's own filter box belongs to the list reader; counting it would make
  // every record page look short, and a warning that always fires is not a check.
  const d = doc(`
    <body><div class="contentContainer">
      <table class="Form">
        <tr><td>Name</td><td><input id="name" value="Ada"></td></tr>
        <tr><td>Zip</td><td><input id="zip" value="90210"></td></tr>
      </table>
      <div class="List"><input id="filter" value=""><a id="searchidx" href="#">Search</a></div>
      <a id="save" href="#">Save</a>
    </div></body>`);
  const form = readForm(d);
  assert.ok(form);
  assert.equal(form.unread, undefined, JSON.stringify(form.unread));
});
