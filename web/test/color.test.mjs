import test from 'node:test';
import assert from 'node:assert/strict';

import { inkFor, luminanceOf } from '../src/lib/color.js';

test('a bright fill takes dark ink, whatever the theme', () => {
  // The calendar's cyan, which shipped white text in the dark theme.
  assert.equal(inkFor('#00ffff'), '#0b1220');
  assert.equal(inkFor('#f3c6ca'), '#0b1220');
  assert.equal(inkFor('rgb(219, 231, 208)'), '#0b1220');
});

test('a dark fill takes white ink', () => {
  assert.equal(inkFor('#111827'), '#ffffff');
  assert.equal(inkFor('#0f141c'), '#ffffff');
});

test('shorthand hex is expanded, and an unparseable fill keeps inherit', () => {
  assert.equal(inkFor('#fff'), '#0b1220');
  assert.equal(inkFor('#000'), '#ffffff');
  assert.equal(inkFor(''), null);
  assert.equal(inkFor('transparent'), null);
  assert.equal(inkFor(null), null);
});

test('luminance is measured, not guessed', () => {
  assert.ok(Math.abs(luminanceOf('#ffffff') - 1) < 0.001);
  assert.equal(luminanceOf('#000000'), 0);
  assert.equal(luminanceOf('nonsense'), null);
});
