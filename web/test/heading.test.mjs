// The heading that says "Actions" is kept for a screen reader and taken off the
// screen: the icon column below it has no words in it either.
import test from 'node:test';
import assert from 'node:assert/strict';

import { isActionHeading } from '../src/lib/heading.js';

test('the action column is recognised in the shapes the app writes it', () => {
  assert.equal(isActionHeading('Actions'), true);
  assert.equal(isActionHeading('Action'), true);
  assert.equal(isActionHeading(' actions '), true);
  assert.equal(isActionHeading('ACTIONS'), true);
});

test('a heading that only starts with the word is a real heading', () => {
  assert.equal(isActionHeading('Actions taken'), false);
  assert.equal(isActionHeading('Action date'), false);
  assert.equal(isActionHeading('Student'), false);
  assert.equal(isActionHeading(''), false);
  assert.equal(isActionHeading(null), false);
});
