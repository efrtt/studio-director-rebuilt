/*
 * The folded rail is a preference, like the colour scheme: one key, read and
 * written without ever throwing. A context with no storage (private mode) must
 * simply not remember the choice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { readRail, writeRail } = await import('../src/lib/rail.js');

function memory() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

test('the rail starts open and remembers being folded', () => {
  const s = memory();
  assert.equal(readRail(s), false);
  assert.equal(writeRail(true, s), true);
  assert.equal(readRail(s), true, 'folded survives a page change');
  assert.equal(writeRail(false, s), true);
  assert.equal(readRail(s), false);
});

test('the mind is not blown by storage that throws', () => {
  const hostile = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); }
  };
  assert.equal(readRail(hostile), false);
  assert.equal(writeRail(true, hostile), false);
  assert.equal(readRail(null), false);
  assert.equal(writeRail(true, null), false);
});
