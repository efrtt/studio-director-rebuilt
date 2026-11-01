/*
 * Tests for src/lib/note.js — the "a sentence and the app's button" screen.
 *
 * `AddMultiplePayments` is the real shape: the server sends a breadcrumb, a
 * title, a button bar and a `contentInfo` block with instructions, and one
 * control. 68 of the 447 crawled screens look like this, and before this reader
 * they all landed on "no view for this page yet".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import { readPage } from '../src/lib/page.js';
import { readNote, contradictsNote } from '../src/lib/note.js';

const URL = 'https://app.thestudiodirector.com/studio1/admin.sd?page=AddMultiplePayments';

const noticeHtml = `<form id="idForm"><div class="contentContainer"><div class="Content">
  <div class="Breadcrumb"><a href="admin.sd?page=ChargesHome">Charges</a></div>
  <div class="formTitle">Add Multiple Payments</div>
  <div class="ButtonBar"></div>
  <div class="contentInfo">
    <b>Add Multiple Payments</b>
    <p>Pick the family that is paying.</p>
    <p><a class="Btn" id="pickfamily" href="admin.sd?page=PickFamily">Pick a family</a></p>
  </div>
</div></div></form>`;

const docOf = (html) => new DOMParser().parseFromString(html, 'text/html');

test('a notice screen is read as its instruction plus the app controls', () => {
  const note = readNote(docOf(noticeHtml));
  assert.ok(note, 'the shell is recognised');
  assert.equal(note.title, 'Add Multiple Payments');
  assert.deepEqual(Array.from(note.lines), ['Pick the family that is paying.']);
  assert.equal(note.actions.length, 1);
  assert.equal(note.actions[0].label, 'Pick a family');
  assert.deepEqual(Array.from(note.breadcrumb), ['Charges']);
});

test('the notice screen is routed to the note view, not left unread', () => {
  const model = readPage(docOf(noticeHtml), URL);
  assert.equal(model.view, 'note');
  assert.equal(model.title, 'Add Multiple Payments');
  assert.ok(model.note && model.note.actions.length === 1);
});

test('a note never takes over a page another reader should own', () => {
  // A control to type into is a form.
  const withInput = noticeHtml.replace(
    '<p>Pick the family that is paying.</p>',
    '<p>Pick the family that is paying.</p><p><input id="amount" name="amount"></p>'
  );
  assert.equal(readNote(docOf(withInput)), null);

  // Two data rows are a table.
  const withRows = noticeHtml.replace(
    '<div class="ButtonBar"></div>',
    '<div class="ButtonBar"></div><table class="ReportTable"><tr><th>A</th></tr>'
      + '<tr><td>1</td></tr><tr><td>2</td></tr></table>'
  );
  assert.equal(readNote(docOf(withRows)), null);
});

test('a page with nothing but a link is not a notice', () => {
  const bare = `<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Empty</div>
    <p><a class="Btn" href="admin.sd?page=HomePage">Home</a></p>
  </div></div></form>`;
  // One link and no sentence: there is nothing to say about this page.
  assert.equal(readNote(docOf(bare)), null);
});

test('the app’s Yes and No buttons are controls, not a sentence', () => {
  // Add Class Charge ends on a page with no `page=` in its URL: the charge is
  // saved and the app offers New / Yes / No. The buttons are `<div class="Btn">`,
  // so stripping only links and inputs left their own words as the page's one
  // line - "YesNo" - and the screen read as a notice saying nothing.
  const yesNo = `<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Add Class Charge</div>
    <div class="contentInfo">
      <div class="Btn" onclick="StudioDir.onSubmit('Yes')">Yes</div>
      <div class="Btn" onclick="StudioDir.onSubmit('No')">No</div>
    </div>
  </div></div></form>`;

  assert.equal(readNote(docOf(yesNo)), null, 'nothing to say, so the page is left alone');

  // With a real sentence above them, that sentence is the line - not "YesNo".
  const withMessage = yesNo.replace('<div class="contentInfo">',
    '<div class="contentInfo"><p>Charge added. Add another?</p>');
  const note = readNote(docOf(withMessage));
  assert.ok(note);
  assert.deepEqual(Array.from(note.lines), ['Charge added. Add another?']);
});

test('the question beside the Yes and No pair is the line', () => {
  // The live page, as the original shows it: a New button, then the question on
  // its own, then the pair. The question sits outside `.contentInfo`, so reading
  // only that block found the buttons and said "YesNo".
  const live = `<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="Breadcrumb"><a href="admin.sd?page=ChargesHome">Charges &amp; Payments</a></div>
    <div class="formTitle">Add Class Charge</div>
    <div class="contentInfo"><div class="Btn" onclick="StudioDir.onSubmit('New')">New</div></div>
    <div class="warning">Are you sure you want to charge $1.00 to all students that are enrolled in 1?</div>
    <div class="contentInfo">
      <div class="Btn" onclick="StudioDir.onSubmit('Yes')">Yes</div>
      <div class="Btn" onclick="StudioDir.onSubmit('No')">No</div>
    </div>
  </div></div></form>`;

  const note = readNote(docOf(live));
  assert.ok(note, 'a question and the app’s controls is a notice screen');
  assert.equal(note.title, 'Add Class Charge');
  assert.deepEqual(Array.from(note.lines),
    ['Are you sure you want to charge $1.00 to all students that are enrolled in 1?']);
  assert.deepEqual(Array.from(note.actions.map((a) => a.label)), ['New', 'Yes', 'No']);
});

/*
 * The tiebreaker main.js uses before it trusts a note. These pages are the real
 * ones from the live walk: `ChargesHome` fetched as a shell and drew 18 links,
 * `Unenroll` drew five form controls. A note read from the fetched shell of
 * either would be a sentence from a screen that is not on the page.
 */
test('a live menu contradicts the note its fetched shell produced', () => {
  const shell = `<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Charges</div>
  </div></div></form>`;
  assert.equal(contradictsNote(docOf(shell)), false);

  const links = Array.from({ length: 18 }, (_, i) =>
    `<a href="admin.sd?page=NewFamilyCharge${i}">Charge ${i}</a>`).join('');
  const live = shell.replace('<div class="formTitle">Charges</div>',
    '<div class="formTitle">Charges</div>' + links);

  assert.equal(contradictsNote(docOf(live)), true);
  assert.equal(readNote(docOf(live)), null);
  // And it is routed as what it is, not as a notice.
  assert.equal(readPage(docOf(live), 'admin.sd?page=ChargesHome').view, 'index');
});

test('live form controls contradict a notice, and the fetched copy does not', () => {
  const withInputs = noticeHtml.replace(
    '<p>Pick the family that is paying.</p>',
    '<p>Pick the family that is paying.</p>'
      + '<p><input id="a"><input id="b"><input id="c"><input id="d"><input id="e"></p>'
  );
  assert.equal(contradictsNote(docOf(noticeHtml)), false, 'the fetched notice holds no form');
  assert.equal(contradictsNote(docOf(withInputs)), true);
  assert.equal(readNote(docOf(withInputs)), null);
});
