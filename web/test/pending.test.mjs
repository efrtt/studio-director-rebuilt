// The confirmation that has not happened yet.
//
// `Unenroll` is the shape: a warning sentence, no field to type into, and one app
// button that calls back into the app. It is the same screen as a save response
// one step earlier, so it renders as the same card, with that button. These tests
// pin what makes it a question rather than a form, a menu, or a notice.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { confirmationOf, pendingConfirmation } from '../src/lib/confirmation.js';
import { readPage } from '../src/lib/page.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const ask = (body = '') => `<form id="idForm"><div class="contentContainer"><div class="Content">
  <div class="Breadcrumb"><a href="admin.sd?page=HomePage">Home</a></div>
  <div class="formTitle">Drop Student</div>
  <div class="ButtonBar"></div>
  <div class="contentInfo">
    <input type="hidden" name="args1" value="0">
    <p>Dropping the student takes them out of this class.</p>
    <p><a class="Btn" id="continue" href="#" onclick="StudioDir.onCallMethodSubmit('Unenroll','confirm','args1');;return false;">Continue</a></p>
    ${body}
  </div>
</div></div></form>`;

test('a warning with one app button is a question, not an outcome', () => {
  const model = pendingConfirmation(doc(ask()));

  assert.ok(model, 'the page is recognised');
  assert.equal(model.kind, 'confirm');
  assert.equal(model.pending, true, 'nothing has happened yet');
  assert.equal(model.title, 'Drop Student');
  assert.equal(model.message, 'Dropping the student takes them out of this class.');
  assert.equal(model.actions.length, 1);
  assert.equal(model.actions[0].label, 'Continue');
  assert.equal(model.actions[0].id, 'continue');
  assert.match(model.actions[0].onclick, /onCallMethodSubmit/);
});

test('it is reached through the confirmation reader, so the view is confirm', () => {
  const model = readPage(doc(ask()), 'https://app.thestudiodirector.com/studio1/admin.sd?page=Unenroll&sident=1&cident=2');
  assert.equal(model.view, 'confirm');
  assert.equal(model.confirm.pending, true);
});

test('an outcome sentence still wins over the ask shape', () => {
  const withOutcome = doc(ask().replace(
    '<p>Dropping the student takes them out of this class.</p>',
    '<p>The student has been removed from this class.</p>'
  ));
  const model = confirmationOf(withOutcome);
  assert.equal(model.pending, undefined, 'this is an outcome, not a question');
  assert.equal(model.ok, true);
});

test('a field to type into makes it a form, not a question', () => {
  const withInput = doc(ask('<input id="reason" name="reason">'));
  assert.equal(pendingConfirmation(withInput), null);
});

test('rows or a menu are not questions either', () => {
  const rows = doc(ask('<table><tr><td>1</td><td>2</td></tr></table>'));
  assert.equal(pendingConfirmation(rows), null);

  const links = doc(ask(Array.from({ length: 6 }, (_, i) => `<p><a href="admin.sd?page=P${i}">P${i}</a></p>`).join('')));
  assert.equal(pendingConfirmation(links), null);
});

test('two submit buttons are not answered by guessing which one', () => {
  const twice = doc(ask(
    '<p><a class="Btn" id="cancel" href="#" onclick="StudioDir.onCallMethodSubmit(\'Unenroll\',\'cancel\',\'args1\');return false;">Cancel</a></p>'
  ));
  assert.equal(pendingConfirmation(twice), null);
});

test('a sentence sharing its paragraph with the button is still the sentence', () => {
  // The live page puts the warning and Continue in one <p>; the captured fixture
  // had them apart, so this is the case the live run caught.
  const merged = doc(`<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="Breadcrumb"><a href="admin.sd?page=HomePage">Home</a></div>
    <div class="formTitle">Drop Student</div>
    <div class="contentInfo">
      <input type="hidden" name="args1" value="0">
      <p>Dropping the student takes them out of this class.
        <a class="Btn" id="continue" href="#" onclick="StudioDir.onCallMethodSubmit('Unenroll','confirm','args1');return false;">Continue</a>
      </p>
    </div>
  </div></div></form>`);

  const model = pendingConfirmation(merged);
  assert.ok(model, 'the page is still a question');
  assert.deepEqual(model.lines, ['Dropping the student takes them out of this class.']);
  assert.equal(model.actions[0].label, 'Continue');
});
