// Which shape an action's own label asks for, and the rules that draw it.
//
// The app labels its row controls itself — Drop here, Unenroll there, Remove in
// a ledger — and the shape has to come from the words. A label this cannot
// place keeps its text, because a guessed tick on something that cancels is
// worse than a word.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { actionIcon } from '../src/lib/actionicon.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, '..', 'src', 'styles.css'), 'utf8');

test('the verbs the app uses get a shape', () => {
  assert.equal(actionIcon('Drop'), 'drop');
  assert.equal(actionIcon('Drop from class'), 'drop');
  assert.equal(actionIcon('Unenroll'), 'drop');
  assert.equal(actionIcon('Remove'), 'drop');
  assert.equal(actionIcon('Enroll'), 'done');
  assert.equal(actionIcon('Enroll in class'), 'done');
  assert.equal(actionIcon('Approve'), 'done');
  assert.equal(actionIcon('Edit'), 'edit');
  assert.equal(actionIcon('Change'), 'edit');
  assert.equal(actionIcon('Manage'), 'edit');
});

test('the three enrollment controls get three different shapes', () => {
  // "Edit Enroll Dates", "Edit Attendance" and "Drop" sit next to each other in
  // one cell. Two pencils would make the first two indistinguishable, so each
  // names the record it opens. The generic verb must not win first.
  assert.equal(actionIcon('Edit Enroll Dates'), 'dates');
  assert.equal(actionIcon('Edit Enrollment Dates'), 'dates');
  assert.equal(actionIcon('Edit Attendance'), 'attendance');
  assert.equal(actionIcon('Drop'), 'drop');
  const shapes = ['Edit Enroll Dates', 'Edit Attendance', 'Drop'].map(actionIcon);
  assert.equal(new Set(shapes).size, 3, 'no two of them share a glyph');
  // A different "Edit …" keeps its pencil.
  assert.equal(actionIcon('Edit Family'), 'edit');
});

test('a label it cannot place keeps its word', () => {
  assert.equal(actionIcon('Copy'), '', 'Copy is not a tick or a cross');
  assert.equal(actionIcon('Print'), '');
  assert.equal(actionIcon('Statement'), '');
  assert.equal(actionIcon(null), '');
  assert.equal(actionIcon('   '), '');
});

test('the icons are masks, not a webfont', () => {
  for (const name of ['edit', 'drop', 'done', 'dates', 'attendance']) {
    assert.match(css, new RegExp('\\.sd-icon--' + name + ' \\{ --glyph: url\\("data:image/svg\\+xml,'), name);
  }
  assert.match(css, /mask: var\(--glyph\) center \/ contain no-repeat/);
  assert.equal(/@font-face/.test(css), false, 'no font is embedded');
  assert.match(css, /fontawesome\.com\/license\/free/, 'the icons are CC BY, and say so');
});

test('the row no longer answers the pointer', () => {
  // The banding stays; the hover wash on every cell is what went away, so
  // pointing at a balance does not look like pointing at a target.
  assert.equal(/\btbody tr:hover/.test(css), false, 'styles.css has no row hover');
  const wii = fs.readFileSync(path.join(here, '..', 'src', 'wii.css'), 'utf8');
  assert.equal(/\btbody tr:hover/.test(wii), false, 'wii.css has no row hover either');
});
