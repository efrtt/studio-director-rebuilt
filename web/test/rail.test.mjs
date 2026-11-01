/*
 * The folded rail is a preference, like the colour scheme: one key, read and
 * written without ever throwing. A context with no storage (private mode) must
 * simply not remember the choice.
 *
 * The active link lives here too, because the live app made a mess of it: every
 * nav link carries the same `clicktab=1`, so comparing that as a tab name lit up
 * all eleven at once and the rail drew eleven active cards.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { readRail, writeRail } = await import('../src/lib/rail.js');
const { isActiveHref } = await import('../src/lib/activelink.js');

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

const BASE = 'https://app.thestudiodirector.com';
const nav = [
  'admin.sd?page=HomePage&clicktab=1',
  'admin.sd?page=CalendarPage&clicktab=1',
  'admin.sd?page=NewClass&clicktab=1',
  'admin.sd?page=NewFamily&clicktab=1',
  'admin.sd?page=NewStudent&clicktab=1',
  'admin.sd?page=NewInstructor&clicktab=1',
  'admin.sd?page=ChargesHome&clicktab=1',
  'admin.sd?page=EmailTextHome&clicktab=1',
  'admin.sd?page=AdvSearch&clicktab=1',
  'admin.sd?page=ReportsHome&clicktab=1',
  'admin.sd?page=AdminHome&clicktab=1'
];

test('one link is active, not all of them', () => {
  // The real URLs: `/srvda/admin.sd?page=CalendarPage&clicktab=1` against the
  // nav above. Every link shares clicktab=1, so only the page can decide.
  const current = `${BASE}/srvda/admin.sd?page=CalendarPage&clicktab=1`;
  const active = nav.filter((href) => isActiveHref(current, href, BASE));
  assert.deepEqual(active, ['admin.sd?page=CalendarPage&clicktab=1']);
});

test('on a settings page, Settings is the one link', () => {
  const current = `${BASE}/srvda/admin.sd?page=AdminHome&clicktab=1`;
  const active = nav.filter((href) => isActiveHref(current, href, BASE));
  assert.deepEqual(active, ['admin.sd?page=AdminHome&clicktab=1']);
});

test('a word-like clicktab still wins over the page name', () => {
  // Some app links name their tab ("clicktab=Classes") and land on NewClass:
  // the section, not the page, is what the rail is showing.
  const current = `${BASE}/srvda/admin.sd?page=NewClass&clicktab=Classes`;
  assert.equal(isActiveHref(current, 'admin.sd?page=NewClass&clicktab=Classes', BASE), true);
  assert.equal(isActiveHref(current, 'admin.sd?page=NewFamily&clicktab=Families', BASE), false);
});

test('a page with no page name marks nothing', () => {
  assert.equal(isActiveHref(`${BASE}/srvda/admin.sd`, 'admin.sd?page=NewClass&clicktab=1', BASE), false);
  assert.equal(isActiveHref('', 'admin.sd?page=NewClass&clicktab=1', BASE), false);
});
