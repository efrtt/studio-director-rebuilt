// The accent preference.
//
// Small, and easy to get subtly wrong: an unknown stored value must not become
// `undefined`, a tone that no longer exists must fall back rather than leave the
// stylesheet without a value, and a context with no storage must still render.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCENTS, ACCENT_LABEL, ACCENT_SWATCH, DEFAULT_ACCENT, readAccent, writeAccent, applyAccent
} from '../src/lib/accent.js';

const fakeStore = () => ({
  map: new Map(),
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; },
  setItem(k, v) { this.map.set(k, String(v)); }
});

test('a fresh install gets the default accent, and a broken value is not trusted', () => {
  assert.equal(readAccent(fakeStore()), DEFAULT_ACCENT);
  const bad = fakeStore();
  bad.setItem('sd.accent', 'chartreuse');
  assert.equal(readAccent(bad), DEFAULT_ACCENT);
  // No storage at all (private mode) still has an answer.
  assert.equal(readAccent(null), DEFAULT_ACCENT);
});

test('a choice is remembered, and only a real tone is stored', () => {
  const store = fakeStore();
  assert.equal(writeAccent('violet', store), true);
  assert.equal(readAccent(store), 'violet');
  assert.equal(writeAccent('plaid', store), false, 'not an accent');
  assert.equal(readAccent(store), 'violet', 'and the old one survives');
});

test('every accent has a label and a swatch, and the swatches are colours', () => {
  for (const name of ACCENTS) {
    assert.equal(typeof ACCENT_LABEL[name], 'string', name + ' has a label');
    assert.ok(ACCENT_LABEL[name].length > 0, name + ' has a label');
    assert.match(ACCENT_SWATCH[name], /^#[0-9a-f]{6}$/i, name + ' has a hex swatch');
  }
  // No duplicates: two tones that look the same are one tone.
  assert.equal(new Set(Object.values(ACCENT_SWATCH)).size, ACCENTS.length);
});

test('applying an accent writes the attribute the stylesheet reads', () => {
  const root = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  assert.equal(applyAccent('teal', root), 'teal');
  assert.equal(root.attrs['data-sd-accent'], 'teal');
  // An unknown value falls back rather than writing something no rule matches.
  assert.equal(applyAccent('hotpink', root), DEFAULT_ACCENT);
  assert.equal(root.attrs['data-sd-accent'], DEFAULT_ACCENT);
  // Nothing to write to is not an error.
  assert.equal(applyAccent('teal', null), null);
});
