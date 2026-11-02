/*
 * The jump palette's two halves: the search it draws and the history behind
 * "Most used". Neither touches the DOM, so both can be driven from a test.
 *
 * The catalogue itself is generated from the crawl; the last test here is what
 * keeps it honest — regenerate the file, or the suite says so.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { matches, rowsFor, flatRows, step, JUMP_LIMIT } from '../src/lib/jump.js';
import { menuFor, layoutForTitle } from '../src/lib/menu.js';
import {
  keyOf, readUsage, recordUse, topUsed, readRecent, recordRecent, RECENT_MAX
} from '../src/lib/usage.js';
import { DESTINATIONS } from '../src/lib/destinations.js';
import { buildDestinations } from '../tools/build-destinations.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function store(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key)
  };
}

const entry = (label, menu, code = '') => ({ code, label, menu, href: 'admin.sd?page=' + (code || label) });

test('each menu page gets the layout it was designed for', () => {
  assert.equal(menuFor('Settings'), 'Settings');
  assert.equal(menuFor('Reports Home'), 'Reports', 'the report menu names itself "Reports Home"');
  assert.equal(menuFor('Charges & Payments'), 'Charges & Payments');
  assert.equal(menuFor('Communications'), 'Communications');

  assert.equal(layoutForTitle('Settings'), 'grouped');
  assert.equal(layoutForTitle('Reports Home'), 'grouped');
  assert.equal(layoutForTitle('Charges & Payments'), 'cards');
  assert.equal(layoutForTitle('Communications'), 'cards');

  // A menu this build has not seen keeps every link on screen.
  assert.equal(menuFor('Manage Google'), '');
  assert.equal(layoutForTitle('Anything else'), 'grouped');
});

test('the palette matches on words, not on one exact string', () => {
  const row = entry('Manage reg fee rules', 'Settings', 'ManageRegFeeRules');
  assert.equal(matches(row, 'reg fee'), true);
  assert.equal(matches(row, 'regfee'), true, 'the code is searchable too');
  assert.equal(matches(row, 'Settings'), true, 'and so is the menu it lives on');
  assert.equal(matches(row, 'invoice'), false);
  assert.equal(matches(row, ''), true, 'an empty query matches everything');
});

test('results are grouped by menu and capped', () => {
  const catalog = [
    entry('Charge summary', 'Reports', 'ChargeSummaryForm'),
    entry('Class roster', 'Reports', 'ClassRosterForm'),
    entry('New family charge', 'Charges & Payments', 'NewFamilyCharge'),
    entry('Manage email templates', 'Settings', 'ManageEmailTemplates')
  ];

  const groups = rowsFor(catalog, 'charge');
  assert.deepEqual(groups.map((g) => g.menu), ['Reports', 'Charges & Payments']);
  assert.equal(flatRows(groups).length, 2, 'the roster does not contain "charge"');

  const capped = rowsFor(catalog, '', { limit: 2 });
  assert.equal(flatRows(capped).length, 2, 'a short cap is respected');

  // The rows keep the order the catalogue has, which is the crawl's order.
  assert.equal(rowsFor(catalog, 'charge')[1].rows[0].code, 'NewFamilyCharge');
});

test('an empty query offers recents first, then the page you are on', () => {
  const catalog = [
    entry('Home', 'Menu', 'HomePage'),
    entry('Setup season wizard', 'Settings', 'SetupSeasonWizard'),
    entry('Manage holidays', 'Settings', 'ManageHolidays'),
    entry('Class roster', 'Reports', 'ClassRosterForm')
  ];
  const recent = [catalog[3], catalog[0]];

  const groups = rowsFor(catalog, '', { recent, here: 'Settings' });
  assert.deepEqual(groups.map((g) => g.menu), ['Recent', 'Settings']);
  assert.equal(groups[0].rows[0].label, 'Class roster');

  // With no history and no page context, something is still on screen.
  const bare = rowsFor(catalog, '', {});
  assert.equal(flatRows(bare).length, Math.min(catalog.length, JUMP_LIMIT));
});

test('the keyboard wraps at both ends', () => {
  assert.equal(step(-1, 3, 1), 0, 'first arrow down selects the first row');
  assert.equal(step(-1, 3, -1), 2, 'arrow up from nothing selects the last');
  assert.equal(step(2, 3, 1), 0);
  assert.equal(step(0, 3, -1), 2);
  assert.equal(step(0, 0, 1), -1, 'an empty list has no selection');
});

test('a visit is counted against the destination, not the click’s tab', () => {
  const s = store();
  assert.deepEqual(readUsage(s), {});
  recordUse(s, 'admin.sd?page=NewFamilyCharge&clicktab=1');
  recordUse(s, 'admin.sd?page=NewFamilyCharge');
  assert.equal(readUsage(s)['admin.sd?page=NewFamilyCharge'], 2);

  // A store that refuses to write must not break the click.
  const angry = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.deepEqual(recordUse(angry, 'admin.sd?page=NewFamilyCharge'),
    { 'admin.sd?page=NewFamilyCharge': 1 }, 'the count survives a refused write');
  assert.deepEqual(readUsage(null), {});

  // Garbage in storage is ignored rather than thrown.
  const broken = store({ 'sd.usage.v1': '{not json' });
  assert.deepEqual(readUsage(broken), {});
  assert.equal(keyOf('admin.sd?page=X&clicktab=4'), 'admin.sd?page=X');
});

test('most used is count order, with ties left in the page’s own order', () => {
  const items = [
    { label: 'A', href: 'admin.sd?page=A' },
    { label: 'B', href: 'admin.sd?page=B' },
    { label: 'C', href: 'admin.sd?page=C' }
  ];
  const usage = { 'admin.sd?page=B': 2, 'admin.sd?page=C': 2 };

  assert.deepEqual(topUsed(usage, items).map((i) => i.label), ['B', 'C']);
  assert.deepEqual(topUsed({}, items), [], 'no history means no row at all');
  assert.deepEqual(topUsed(usage, items, 1).map((i) => i.label), ['B']);
});

test('recents keep the last four, without duplicates', () => {
  const s = store();
  for (let i = 0; i < RECENT_MAX + 2; i += 1) recordRecent(s, 'admin.sd?page=P' + i);
  recordRecent(s, 'admin.sd?page=P3');
  const list = readRecent(s);

  assert.equal(list.length, RECENT_MAX);
  assert.equal(list[0], 'admin.sd?page=P3', 'the last one opened is first');
  assert.equal(new Set(list).size, list.length);
  assert.deepEqual(readRecent(null), []);
});

test('the catalogue is the crawl’s menus, and is current', () => {
  assert.ok(DESTINATIONS.length > 150, 'the four menus carry hundreds of destinations');
  for (const item of DESTINATIONS) {
    assert.ok(item.code && item.label && item.menu, 'every entry is complete');
    assert.equal(/[()]/.test(item.code), false, 'a shape needing a value is not a destination');
    assert.notEqual(item.code, 'HomePage', 'the repeated nav link is not one');
  }

  // Drift guard: if data/pages.json was re-crawled and the catalogue not rebuilt,
  // this fails with the instruction rather than shipping a stale palette.
  const crawl = JSON.parse(fs.readFileSync(path.join(here, '../data/pages.json'), 'utf8'));
  assert.deepEqual(DESTINATIONS, buildDestinations(crawl.pages),
    'run `node tools/build-destinations.mjs` after a crawl');
});
