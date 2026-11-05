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

// The drop-in flow's own question, measured live (2026-11-05). After a date is
// picked the app asks before it goes on, and answers with two plain links: no
// scripted button (so `pendingConfirmation` refuses) and no Delete (so
// `askedConfirmation` refuses), which left the one screen that asks unskinned.
const dropInAsk = doc(`<body><div class="contentContainer"><div class="Content">
  <div class="Breadcrumb"><a href="admin.sd?page=HomePage">Home</a></div>
  <div class="formTitle">Add Trial/Drop-in</div>
  <div class="ButtonBar"></div>
  <div class="contentInfo">
    <p>11 out of 15 students are enrolled in
      <a href="admin.sd?page=EditClass&cident=1">Graduating Seniors</a> on Mon, Nov 2, 2026.
      There are 0 make-ups and 0 drop-ins/trials. Are you sure you want to schedule a
      trial/drop-in for <a href="admin.sd?page=EditStudent&sident=2">Lily</a> on this day?</p>
    <p><a class="Btn" href="admin.sd?page=AddStudentDropIn&amp;meth=pickCharge&amp;tid=9">Continue</a>
      <a class="BtnOutln" href="admin.sd?page=AddStudentDropIn&amp;sident=2&amp;tid=9">Cancel</a></p>
  </div>
</div></div></body>`);

test('a question answered by the page\u2019s own links is still a question', () => {
  const model = confirmationOf(dropInAsk, {});

  assert.ok(model, 'the page is recognised');
  assert.equal(model.pending, true, 'nothing has been scheduled yet');
  assert.equal(model.title, 'Add Trial/Drop-in');
  assert.match(model.message, /Are you sure you want to schedule a trial\/drop-in for Lily on this day\?/);
  assert.deepEqual(model.actions.map((a) => a.label), ['Continue', 'Cancel'], 'both answers are the app\u2019s links');
  assert.match(model.actions[0].href, /meth=pickCharge/);
  assert.match(model.actions[1].href, /sident=2/);
  assert.match(model.lines[0], /11 out of 15 students/, 'the reason it asks is kept');
});

// The last page of the same flow, measured live (2026-11-05): a bare `admin.sd`
// with one sentence — "… has been scheduled to drop in on class …" — and three
// links onward. `scheduled` was not a known outcome, so the page the flow ends on
// was the other one left unskinned.
const scheduled = doc(`<body><div class="contentContainer"><div class="Content">
  <div class="Breadcrumb"><a href="admin.sd?page=HomePage">Home</a></div>
  <div class="formTitle">Add Trial/Drop-in</div>
  <div class="ButtonBar"></div>
  <div class="contentInfo">
    <p><a href="admin.sd?page=EditStudent&sident=2">Lily</a> has been scheduled to drop in on class
      <a href="admin.sd?page=EditClass&cident=1">Graduating Seniors</a> on Mon, Nov 2, 2026.</p>
    <p><a href="admin.sd?page=EditStudent&sident=2">Return to Lily</a></p>
    <p><a href="admin.sd?page=EditFamily&fident=3">Review the account for Lily</a>
      <a href="admin.sd?page=EditClass&cident=1">Go to Graduating Seniors</a></p>
  </div>
</div></div></body>`);

test('a scheduled drop-in is an outcome, not a page with no view', () => {
  const model = confirmationOf(scheduled, {});

  assert.ok(model, 'the page is recognised');
  assert.equal(model.pending, undefined, 'it has happened');
  assert.equal(model.ok, true);
  assert.equal(model.title, 'Add Trial/Drop-in');
  assert.match(model.message, /has been scheduled to drop in on class Graduating Seniors/);
  const onward = model.links.map((l) => l.label);
  assert.ok(onward.includes('Return to Lily'), 'the record it changed');
  assert.ok(onward.includes('Go to Graduating Seniors'), 'the class it joined');
});

// Dropping a student from a single date, measured live (2026-11-05):
// `page=DropStudentMakeup` asks the same question with two plain links, Drop and
// Cancel, and no list beside it. `askedConfirmation` recognised it, but its model
// had no `lines` — which the card the view draws iterates — so the mount threw
// and the screen came up blank.
const dropMakeupAsk = doc(`<body><div class="contentContainer"><div class="Content">
  <div class="Breadcrumb"><a href="admin.sd?page=HomePage">Home</a></div>
  <div class="formTitle">Drop Student</div>
  <div class="ButtonBar"></div>
  <div class="contentInfo">
    <p>Are you sure you want to drop <a href="admin.sd?page=EditStudent&sident=2">Lily</a> from
      <a href="admin.sd?page=EditClass&cident=1">Graduating Seniors</a> on Mon, Nov 2, 2026?</p>
    <p><a class="Btn" href="admin.sd?page=DropStudentMakeup&amp;meth=yes&amp;tid=9">Drop</a>
      <a class="BtnOutln" href="admin.sd?page=DropStudentMakeup&amp;meth=no&amp;tid=9">Cancel</a></p>
  </div>
</div></div></body>`);

test('the drop question carries the sentence its card draws', () => {
  const model = confirmationOf(dropMakeupAsk, {});

  assert.ok(model, 'the page is recognised');
  assert.equal(model.pending, true);
  assert.deepEqual(model.lines, [
    'Are you sure you want to drop Lily from Graduating Seniors on Mon, Nov 2, 2026?'
  ], 'the view iterates `lines`; without one it drew nothing at all');
  assert.equal(model.actions[0].label, 'Drop');
  assert.equal(model.links[0].label, 'Cancel', 'the way out is on the card');
});

// Dropping it again, measured live (2026-11-05): `page=DropStudentMakeup&meth=yes`
// answers "Lily's make-up/trial/drop-in session in Graduating Seniors on Mon,
// Nov 2, 2026 has been cancelled." — the other half of the same pair of pages.
const cancelled = doc(`<body><div class="contentContainer"><div class="Content">
  <div class="Breadcrumb"><a href="admin.sd?page=HomePage">Home</a></div>
  <div class="formTitle">Drop Student</div>
  <div class="ButtonBar"></div>
  <div class="contentInfo">
    <p><a href="admin.sd?page=EditStudent&sident=2">Lily</a>'s make-up/trial/drop-in session in
      <a href="admin.sd?page=EditClass&cident=1">Graduating Seniors</a> on Mon, Nov 2, 2026 has been cancelled.</p>
    <p><a href="admin.sd?page=EditStudent&sident=2">Return to Lily</a>
      <a href="admin.sd?page=EditClass&cident=1">Go to Graduating Seniors</a></p>
  </div>
</div></div></body>`);

test('a cancelled drop-in session is an outcome too', () => {
  const model = confirmationOf(cancelled, {});

  assert.ok(model, 'the page is recognised');
  assert.equal(model.pending, undefined);
  assert.equal(model.ok, true);
  assert.equal(model.title, 'Drop Student');
  assert.match(model.message, /has been cancelled\.$/);
  const onward = model.links.map((l) => l.label);
  assert.ok(onward.includes('Return to Lily'));
  assert.ok(onward.includes('Go to Graduating Seniors'));
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
