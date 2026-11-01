// The confirmation sentence, and the way back to where you were.
//
// Reported from the live app: the success line ended in a link ("Review the
// account for …"), and read as text it ran on from the message. The card also had
// no way back to the page the enrollment started from.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { confirmationOf } from '../src/lib/confirmation.js';
import { backTarget } from '../src/lib/backlink.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const page = (inner) => doc(`<body><div class="Content">
  <div class="formTitle"></div>
  <div class="contentInfo">${inner}</div>
</div></body>`);

test('the sentence does not swallow the link after it', () => {
  const model = confirmationOf(page(
    '<div>Lily has been enrolled in 520 Contemporary 1<a href="admin.sd?page=EditStudent&sident=1">Review the account for Lily</a></div>'
  ), {});

  assert.ok(model, 'the page is a confirmation');
  assert.equal(model.message, 'Lily has been enrolled in 520 Contemporary 1');
  assert.doesNotMatch(model.message, /Review the account/);
});

test('a plain sentence is unchanged', () => {
  const model = confirmationOf(page('<div>Hopper Family has been updated.</div>'), {});
  assert.equal(model.message, 'Hopper Family has been updated.');
});

test('back is the page that posted, never another site or this page', () => {
  const here = 'https://app.thestudiodirector.com/srvda/admin.sd';
  const posted = 'https://app.thestudiodirector.com/srvda/admin.sd?page=EditStudent&sident=1';

  assert.deepEqual(backTarget(posted, here), { href: posted, label: 'Back to the page you came from' });
  assert.equal(backTarget('https://elsewhere.example/x', here), null, 'another site');
  assert.equal(backTarget(here, here), null, 'this page');
  assert.equal(backTarget('', here), null);
  assert.equal(backTarget('not a url', here), null);
});
