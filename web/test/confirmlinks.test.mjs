// A confirmation's way onward is the page's own links.
//
// Reported from the live app: the single referrer button did not go back far enough
// after adding a class, and the drop confirmation offered no buttons at all. The
// page states where you can go - breadcrumb, "Review the account for ...", "Back to
// the student" - so those are the options, with the referrer only as a fallback.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { confirmationOf } from '../src/lib/confirmation.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const page = (inner, crumb) => doc(`<body>
  <div id="sideNavBar"><a href="admin.sd?page=HomePage">Home</a></div>
  <div class="Content">
    <div class="Breadcrumb">${crumb}</div>
    <div class="formTitle">Drop Student</div>
    <div class="contentInfo">${inner}</div>
  </div></body>`);

test('the page own links become the options, breadcrumb first', () => {
  const model = confirmationOf(page(
    '<div><a href="admin.sd?page=EditStudent&sident=1">Lily</a> has been dropped from ' +
    '<a href="admin.sd?page=EditClass&cident=520">520 Contemporary 1</a> ' +
    '<a href="admin.sd?page=EditStudent&sident=1">Review the account for Lily</a></div>',
    '<a href="admin.sd?page=NewStudent">Students</a>'
  ), {});

  assert.ok(model);
  const hrefs = model.links.map((l) => l.href);
  assert.equal(hrefs[0], 'admin.sd?page=NewStudent', 'the breadcrumb leads');
  assert.ok(hrefs.includes('admin.sd?page=EditStudent&sident=1'));
  assert.ok(hrefs.includes('admin.sd?page=EditClass&cident=520'));
  assert.ok(model.links.every((l) => l.label && l.href && l.href !== '#'));
});

test('the rail and the record panel are not options', () => {
  const model = confirmationOf(page(
    '<div>Hopper Family has been updated.</div>',
    '<a href="admin.sd?page=NewFamily">Families</a>'
  ), {});

  const labels = model.links.map((l) => l.label);
  assert.deepEqual(labels, ['Families'], 'only the page own breadcrumb');
});

test('a page with no links offers none', () => {
  const model = confirmationOf(page('<div>Hopper Family has been updated.</div>', ''), {});
  assert.deepEqual(model.links, []);
});
