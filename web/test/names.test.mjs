// Filing names and classes.
//
// The panel states a label and a link, so these rules are the only structure
// the list pages have: a surname to file by, a name to print, and a class name
// with the studio number in front of it.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classParts, displayLabel, indexKey, letterGroups, letterOf, surnameOf
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

test('a class is filed by its name, not by its number', () => {
  assert.equal(indexKey({ label: '101 Ballet III' }, 'Class'), 'Ballet III');
  assert.equal(indexKey({ label: '520 Contemporary 1' }, 'Class'), 'Contemporary 1');
  assert.equal(indexKey({ label: 'Jazz I - Tue 5:30p' }, 'Class'), 'Jazz I');
  assert.equal(indexKey({ label: 'Hip Hop' }, 'Class'), 'Hip Hop');
  // A label that is only a number still has to land somewhere.
  assert.equal(indexKey({ label: '300' }, 'Class'), '300');
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

test('classes group by initial in the same index', () => {
  const groups = letterGroups([
    { label: '101 Ballet III', href: '?page=EditClass&cident=101' },
    { label: 'Jazz I - Tue 5:30p', href: '?page=EditClass&cident=102' },
    { label: '104 Hip Hop', href: '?page=EditClass&cident=104' },
    { label: '520 Ballet IV', href: '?page=EditClass&cident=520' }
  ], 'Class');
  assert.deepEqual(groups.map((g) => g.letter), ['B', 'H', 'J']);
  assert.deepEqual(groups[0].items.map((i) => i.label), ['101 Ballet III', '520 Ballet IV'],
    'a shelf keeps the app order');
});

test('only a trailing weekday is a schedule; the rest of a label is the name', () => {
  assert.deepEqual(classParts('Jazz I - Tue 5:30p'), { name: 'Jazz I', when: 'Tue 5:30p' });
  assert.deepEqual(classParts('101 Ballet III - Mon 4:00p'),
    { name: '101 Ballet III', when: 'Mon 4:00p' });
  assert.deepEqual(classParts('Jazz II - Sat 11:00a'), { name: 'Jazz II', when: 'Sat 11:00a' });
  assert.deepEqual(classParts('Ballet III - Ages 6-9'), { name: 'Ballet III - Ages 6-9', when: '' });
  assert.deepEqual(classParts('Hip Hop'), { name: 'Hip Hop', when: '' });
});
