/*
 * Fallback labels: a field's own name, made readable.
 *
 * The settings and editor readers fall back to a control's id or name when the
 * page prints no label. Those names are the app's internal spelling, so they run
 * the words together - `dropchargedate`, not "Drop charge date".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;

const { humanise } = await import('../src/model/fields.js');

test('a run-together field name becomes words', () => {
  // The four rows on Drop Student, as the app spells them.
  assert.equal(humanise('dropchargedate'), 'Drop charge date');
  assert.equal(humanise('dropclassesdate'), 'Drop classes date');
  assert.equal(humanise('dropreason'), 'Drop reason');
  assert.equal(humanise('dropnotes'), 'Drop notes');
  assert.equal(humanise('emailaddress'), 'Email address');
});

test('the spellings that already read well are untouched', () => {
  assert.equal(humanise('enroll_time'), 'Enroll time');
  assert.equal(humanise('familyMax'), 'Family Max');
  assert.equal(humanise('searchdisplayformat'), 'Search display format');
  // A word in the vocabulary on its own is never chopped up.
  assert.equal(humanise('calendar'), 'Calendar');
  assert.equal(humanise('display'), 'Display');
});

test('a name with no words in it is left whole', () => {
  // No vocabulary hit: better an odd-looking label than "X klmnp".
  assert.equal(humanise('xklmnp'), 'Xklmnp');
  // Known at the front, unknown behind it: the split is not taken.
  assert.equal(humanise('dropzorp'), 'Dropzorp');
  assert.equal(humanise(''), '');
});
