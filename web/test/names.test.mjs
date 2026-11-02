// Filing names and classes.
//
// The panel states a label and a link, so these rules are the only structure
// the list pages have: a surname to file by, a name to print, and a class
// number the studio already uses as a category.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classBandOf, classParts, classShelves, displayLabel, letterGroups, letterOf, surnameOf
} from '../src/lib/names.js';

test('a name prints first-name-first even when it was filed surname-first', () => {
  assert.equal(displayLabel('Lovelace, Ada'), 'Ada Lovelace');
  assert.equal(displayLabel('Grace Hopper'), 'Grace Hopper');
  assert.equal(displayLabel('  Hopper   Family '), 'Hopper Family');
  assert.equal(displayLabel(''), '');
  assert.equal(displayLabel(null), '');
});

test('the index key is the surname, not the first word', () => {
  assert.equal(surnameOf('Ada Lovelace', 'Student'), 'Lovelace');
  assert.equal(surnameOf('Lovelace, Ada', 'Student'), 'Lovelace');
  assert.equal(surnameOf('Grace Hopper'), 'Hopper');
  assert.equal(surnameOf('Hopper Family', 'Family'), 'Hopper');
  assert.equal(surnameOf('Hopper-Smith Family'), 'Hopper-Smith');
  // A suffix is not a surname to file under.
  assert.equal(surnameOf('Grace Hopper Jr.', 'Student'), 'Hopper');
  assert.equal(surnameOf('Grace Hopper III'), 'Hopper');
  // One word is the whole name.
  assert.equal(surnameOf('Lovelace', 'Student'), 'Lovelace');
});

test('a letter index runs A to Z, with the unindexable last', () => {
  assert.equal(letterOf('Lovelace'), 'L');
  assert.equal(letterOf('Áudet'), 'A', 'a diacritic still files under its letter');
  assert.equal(letterOf('o\'neill'), 'O');
  assert.equal(letterOf('101 Ballet'), '#');
  assert.equal(letterOf(''), '#');

  const groups = letterGroups([
    { label: 'Zed Family', href: '?page=EditFamily&fident=1' },
    { label: 'Hopper Family', href: '?page=EditFamily&fident=2' },
    { label: '3d Dance Family', href: '?page=EditFamily&fident=3' },
    { label: 'Alvarez Family', href: '?page=EditFamily&fident=4' }
  ], 'Family');
  assert.deepEqual(groups.map((g) => g.letter), ['A', 'H', 'Z', '#']);
  assert.deepEqual(groups[1].items.map((i) => i.label), ['Hopper Family']);
});

test('classes are shelved by the studio number, not by the label prefix', () => {
  assert.deepEqual(classBandOf({ label: '101 Ballet III' }), { band: 100, label: '100s' });
  assert.deepEqual(classBandOf({ label: 'Contemporary 1', href: 'admin.sd?page=EditClass&cident=520' }),
    { band: 500, label: '500s' });
  assert.deepEqual(classBandOf({ label: 'Hip Hop', href: 'admin.sd?page=EditClass&cident=812' }),
    { band: 800, label: '800s' });
  assert.deepEqual(classBandOf({ label: 'Ballet' }), { band: null, label: 'Other' });

  const shelves = classShelves([
    { label: 'D', href: '?cident=812' },
    { label: 'A', href: '?cident=101' },
    { label: 'E' },
    { label: 'B', href: '?cident=240' },
    { label: 'C', href: '?cident=299' }
  ]);
  assert.deepEqual(shelves.map((s) => s.label), ['100s', '200s', '800s', 'Other']);
  assert.deepEqual(shelves[1].items.map((i) => i.label), ['B', 'C'], 'a shelf keeps the app order');
});

test('only a trailing weekday is a schedule; the rest of a label is the name', () => {
  assert.deepEqual(classParts('Jazz I - Tue 5:30p'), { name: 'Jazz I', when: 'Tue 5:30p' });
  assert.deepEqual(classParts('101 Ballet III - Mon 4:00p'),
    { name: '101 Ballet III', when: 'Mon 4:00p' });
  assert.deepEqual(classParts('Jazz II - Sat 11:00a'), { name: 'Jazz II', when: 'Sat 11:00a' });
  assert.deepEqual(classParts('Ballet III - Ages 6-9'), { name: 'Ballet III - Ages 6-9', when: '' });
  assert.deepEqual(classParts('Hip Hop'), { name: 'Hip Hop', when: '' });
});
