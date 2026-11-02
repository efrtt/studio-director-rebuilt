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
import { confirmSubject } from '../src/lib/deletedname.js';
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

// The app's own delete question, measured live on Manage Vendors (2026-11-02):
// pressing Delete does not post — it navigates to a bare `admin.sd` whose body is
// the sentence, two links, and the record list beside them, with an empty
// `ButtonBar`. `pendingConfirmation` refuses it twice over (no scripted button,
// and it has a table), so without its own reader the screen drew as a plain list
// with the question dropped.
// Copied the way the app sends it: minified, so the title runs straight into the
// sentence ("Manage VendorsAre you sure…"). Written out with indentation this
// fixture passed while the real page never matched — the whitespace that made a
// word boundary was mine, not the app's.
const deleteAsk = `<div class="Content"><div class="Breadcrumb"><a href="admin.sd?page=HomePage">Home</a></div><div class="formTitle">Manage Vendors</div><div class="ButtonBar"></div><div class="contentInfo"><table class="Layout"><tbody><tr><td class="Top">Are you sure you want to delete Test Vendor?<p>
      <a class="BtnDestr" id="delete" href="admin.sd?page=ManageVendors&amp;meth=delconfirmed&amp;vendor_ident=42&amp;clicktab=1">Delete</a>
      <span style="margin-right:10px"></span>
      <a class="BtnOutln" id="cancel" href="admin.sd?page=ManageVendors&amp;meth=edit&amp;vendor_ident=42">Cancel</a>
    </p></td>
    <td class="RHS"><div class="ReportTable">Existing Vendors</div>
      <table class="ReportTable"><tbody>
        <tr><th><div>Vendor</div></th></tr>
        <tr><td><a href="admin.sd?page=ManageVendors&amp;meth=edit&amp;vendor_ident=0"></a></td></tr>
        <tr><td><a href="admin.sd?page=ManageVendors&amp;meth=edit&amp;vendor_ident=42">Test Vendor</a></td></tr>
      </tbody></table></td>
  </tr></tbody></table></div>
</div>`;

test('the app\u2019s delete question is a question, even beside the list it changes', () => {
  const model = confirmationOf(doc(deleteAsk));

  assert.ok(model, 'the page is recognised');
  assert.equal(model.pending, true, 'nothing has been deleted yet');
  assert.equal(model.title, 'Manage Vendors');
  assert.equal(model.message, 'Are you sure you want to delete Test Vendor?', 'the app\u2019s own sentence');
  assert.deepEqual(model.ask, {
    label: 'Delete',
    name: 'Test Vendor',
    href: 'admin.sd?page=ManageVendors&meth=delconfirmed&vendor_ident=42&clicktab=1',
    cancelHref: 'admin.sd?page=ManageVendors&meth=edit&vendor_ident=42'
  }, 'both answers are the app\u2019s own links');
});

test('and the confirmation reader wins the page, so the view is the question', () => {
  const model = readPage(
    doc(`<form id="idForm"><div class="contentContainer">${deleteAsk}</div></form>`),
    'https://app.thestudiodirector.com/srvda/admin.sd'
  );
  assert.equal(model.view, 'confirm');
  assert.ok(model.confirm.ask, 'with a name to put in the dialog');
});

// The app's delete answer prints the record's name as a link it no longer has:
// `<a href="…meth=neu"></a> has been deleted.` — the sentence arrives with no
// subject at all, so the banner would say "has been deleted." and confirm
// nothing. The name is carried from the question; the page label is the
// fallback for a cold page.
test('a deleted sentence that lost its subject gets one back', () => {
  const url = 'https://app.thestudiodirector.com/srvda/admin.sd?page=ManageVendors&meth=delconfirmed&vendor_ident=1';

  assert.equal(
    confirmSubject({ ok: true, message: 'has been deleted.', title: 'Manage Vendors' }, url).message,
    'Vendor has been deleted.',
    'the page labels it when the name could not be carried'
  );
  assert.equal(
    confirmSubject({ ok: true, message: 'test has been updated.', title: 'Manage Vendors' }, url).message,
    'test has been updated.',
    'a sentence the app states in full is left exactly as sent'
  );
  const question = { ok: true, pending: true, message: 'has been deleted.' };
  assert.equal(confirmSubject(question, url), question, 'a question is not an outcome');
});

test('and the name it asked about is the one it prints', () => {
  const stored = JSON.stringify({ page: 'ManageVendors', name: 'testaa' });
  const before = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: { getItem: () => stored, setItem() {} },
    configurable: true
  });

  try {
    assert.equal(
      confirmSubject(
        { ok: true, message: 'has been deleted.', title: 'Manage Vendors' },
        'https://app.thestudiodirector.com/srvda/admin.sd?page=ManageVendors&meth=delconfirmed&vendor_ident=1'
      ).message,
      'testaa has been deleted.',
      'the record the question named'
    );
    // The name belongs to the page that asked it: another page's answer keeps
    // its own, rather than borrowing a vendor's name for a holiday.
    assert.equal(
      confirmSubject(
        { ok: true, message: 'has been deleted.', title: 'Manage Holidays' },
        'https://app.thestudiodirector.com/srvda/admin.sd?page=ManageHolidays&meth=delconfirmed&holiday_ident=1'
      ).message,
      'Holiday has been deleted.'
    );
  } finally {
    if (before) Object.defineProperty(globalThis, 'sessionStorage', before);
    else delete globalThis.sessionStorage;
  }
});
