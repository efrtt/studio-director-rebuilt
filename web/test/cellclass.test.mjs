// How a table cell should be drawn: a place to go, or a control.
//
// The ledger's action column and its description column are both `<a>` in the
// app's markup, and both were rendered as ordinary text links.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isActionHref, cellKind } from '../src/lib/cellclass.js';

test('an app control is not a destination', () => {
  assert.equal(isActionHref('#'), true);
  assert.equal(isActionHref('javascript:void(0)'), true);
  assert.equal(isActionHref('  #  '), true);
  assert.equal(isActionHref('admin.sd?page=EditClass&cident=520'), false);
  assert.equal(isActionHref(''), false);
  assert.equal(isActionHref(null), false);
});

test('a cell is classified by what it holds', () => {
  assert.equal(cellKind({ text: 'Ballet III', href: 'admin.sd?page=EditClass&cident=1' }), 'link');
  assert.equal(cellKind({ text: 'Drop', href: '#' }), 'action');
  assert.equal(cellKind({ text: 'Monday' }), null, 'plain text is neither');
  assert.equal(cellKind(null), null);
});
