// Filing names and classes.
//
// The panel states a label and a link, so these rules are the only structure
// the list pages have: a surname to file by, a name to print, and a class
// number the studio already groups its classes by.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classNumber, classParts, displayLabel, indexKey, letterGroups, letterOf, surnameOf
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

test('a class files under its hundred, not under its name', () => {
  assert.equal(classNumber({ label: '100 Ballet 1' }), '100');
  assert.equal(classNumber({ label: '520 Contemporary 1' }), '520');
  assert.equal(classNumber({ label: 'Ballet III' }), '');
  // Every class link carries a numeric id, so it can never stand in for a number.
  assert.equal(classNumber({ label: 'Ballet III', href: 'admin.sd?page=EditClass&cident=812' }), '');

  assert.equal(indexKey({ label: '100 Ballet 1' }, 'Class'), '1');
  assert.equal(indexKey({ label: '520 Contemporary 1' }, 'Class'), '5');
  // A class with no number joins the letter run instead of falling to '#'.
  assert.equal(indexKey({ label: 'Hip Hop', href: '?cident=812' }, 'Class'), 'Hip Hop',
    'the link is never consulted');
  assert.equal(indexKey({ label: 'Jazz I - Tue 5:30p' }, 'Class'), 'Jazz I');
  // A student is not filed by their number even when the label looks numeric.
  assert.equal(indexKey({ label: 'Ada Lovelace', href: '?sident=9002' }, 'Student'), 'Lovelace');
});

test('a letter index runs A to Z, with the unindexable last', () => {
  assert.equal(letterOf('Lovelace'), 'L');
  assert.equal(letterOf('Áudet'), 'A', 'a diacritic still files under its letter');
  assert.equal(letterOf("o'neill"), 'O');
  assert.equal(letterOf('101 Ballet'), '1', 'a class number is its own heading');
  assert.equal(letterOf(''), '#');

  const groups = letterGroups([
    { label: 'Zed Family', href: '?page=EditFamily&fident=1' },
    { label: 'Hopper Family', href: '?page=EditFamily&fident=2' },
    { label: '3d Dance Family', href: '?page=EditFamily&fident=3' },
    { label: 'Alvarez Family', href: '?page=EditFamily&fident=4' }
  ], 'Family');
  // A name that begins with a number keeps that number as its heading, and
  // numbers sort before letters.
  assert.deepEqual(groups.map((g) => g.letter), ['3', 'A', 'H', 'Z']);
  assert.deepEqual(groups[2].items.map((i) => i.label), ['Hopper Family']);
});

test('class numbers come before letters and keep their order', () => {
  const groups = letterGroups([
    { label: '520 Ballet IV', href: '?page=EditClass&cident=520' },
    { label: '101 Ballet III', href: '?page=EditClass&cident=101' },
    { label: 'Jazz I - Tue 5:30p', href: '?page=EditClass&cident=102' },
    // The ids here are decoys: only the name can say which hundred a class is.
    { label: '812 Hip Hop', href: '?page=EditClass&cident=101' },
    { label: 'Hip Hop', href: '?page=EditClass&cident=812' }
  ], 'Class');
  // The hundreds first, then the classes with no number, by their names.
  assert.deepEqual(groups.map((g) => g.letter), ['1', '5', '8', 'H', 'J']);
  assert.deepEqual(groups[0].items.map((i) => i.label), ['101 Ballet III'],
    'a group keeps the app order');
  assert.deepEqual(groups[4].items.map((i) => i.label), ['Jazz I - Tue 5:30p']);
});

test('only a trailing weekday is a schedule; the rest of a label is the name', () => {
  assert.deepEqual(classParts('Jazz I - Tue 5:30p'), { name: 'Jazz I', when: 'Tue 5:30p' });
  assert.deepEqual(classParts('101 Ballet III - Mon 4:00p'),
    { name: '101 Ballet III', when: 'Mon 4:00p' });
  assert.deepEqual(classParts('Jazz II - Sat 11:00a'), { name: 'Jazz II', when: 'Sat 11:00a' });
  assert.deepEqual(classParts('Ballet III - Ages 6-9'), { name: 'Ballet III - Ages 6-9', when: '' });
  assert.deepEqual(classParts('Hip Hop'), { name: 'Hip Hop', when: '' });
});
