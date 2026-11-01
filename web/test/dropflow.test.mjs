// Dropping a student: the question keeps its names, and the outcome is an outcome.
//
// Reported from the live app: the dialog read "Are you sure you want to drop from
// ?" (the student and class are links, and every anchor was removed), the Drop
// button reported no handler, and the page after dropping rendered as a bare note
// - "has been dropped from" - because "dropped" was not a known outcome.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { confirmationOf, pendingConfirmation } from '../src/lib/confirmation.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const question = doc(`<body><div class="Content">
  <div class="formTitle">Drop Student</div>
  <div class="contentInfo">
    <p>Are you sure you want to drop <a href="admin.sd?page=EditStudent&sident=1">Lily</a> from
      <a href="admin.sd?page=EditClass&cident=520">520 Contemporary 1</a>?</p>
    <a class="Btn" id="dropstudent" onclick="StudioDir.onCallMethodSubmit('DropStudent','drop','args1')">Drop</a>
  </div>
</div></body>`);

const outcome = doc(`<body><div class="Content">
  <div class="formTitle">Drop Student</div>
  <div class="contentInfo">
    <div><a href="admin.sd?page=EditStudent&sident=1">Lily</a> has been dropped from
      <a href="admin.sd?page=EditClass&cident=520">520 Contemporary 1</a>
      <a href="admin.sd?page=EditStudent&sident=1">Review the account for Lily</a></div>
  </div>
</div></body>`);

test('the question keeps the names it asks about', () => {
  const pending = pendingConfirmation(question);
  assert.ok(pending, 'the page is a question');
  assert.equal(pending.pending, true);
  assert.match(pending.message, /drop Lily from/);
  assert.match(pending.message, /520 Contemporary 1/);
  assert.doesNotMatch(pending.message, /drop from \?/, 'the names are not removed');
});

test('a dropped student is an outcome, and the command link is not part of it', () => {
  const model = confirmationOf(outcome, {});
  assert.ok(model, 'dropped is recognised as an outcome');
  assert.equal(model.pending, undefined);
  assert.equal(model.ok, true);
  assert.equal(model.message, 'Lily has been dropped from 520 Contemporary 1');
  assert.doesNotMatch(model.message, /Review the account/);
});

test('a paragraph that is only links is an action bar, not a question', () => {
  // Lifted from the two fixtures whose models must not move: the unenroll page's
  // "Switch Classes / Back to the student" pair, and the Email Class menu.
  const actions = doc(`<body><div class="Content">
    <div class="formTitle">Unenroll</div>
    <div class="contentInfo">
      <p>Dropping the student takes them out of this class.</p>
      <p><a href="admin.sd?page=SwitchClasses">Switch Classes</a>
         <a href="admin.sd?page=EditStudent&sident=1">Back to the student</a></p>
      <a class="Btn" onclick="StudioDir.onCallMethodSubmit('Unenroll','confirm')">Continue</a>
    </div>
  </div></body>`);

  const pending = pendingConfirmation(actions);
  assert.ok(pending, 'still the question screen');
  assert.deepEqual(pending.lines, ['Dropping the student takes them out of this class.']);
});
