// The reader registry, the route decision and the source choice.
//
// These were the three places a rewrite could change behaviour silently: the
// ladder's order, the five entry points main.js hand-rolled, and the question of
// which document a model comes from.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { READERS, readPage } from '../src/readers/index.js';
import { ROUTES, routeOf } from '../src/lib/route.js';
import { chooseSource } from '../src/lib/choose.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

test('the registry order is the contract, most specific first', () => {
  assert.deepEqual(READERS.map((r) => r.id), [
    'confirmation', 'week', 'list', 'report', 'task',
    'sheet', 'index', 'settings', 'note'
  ]);
  // Every reader answers both questions, and records what gates it.
  for (const reader of READERS) {
    assert.equal(typeof reader.read, 'function', reader.id + ' has read');
    assert.equal(typeof reader.claims, 'function', reader.id + ' has claims');
    assert.ok(Array.isArray(reader.after), reader.id + ' records its gate');
  }
  // The gates are exactly the earlier readers, which is what the ladder meant.
  READERS.forEach((reader, i) => {
    assert.deepEqual(reader.after, READERS.slice(0, i).map((r) => r.id).filter((id) => id !== 'confirmation' || reader.id !== 'list'));
  });
});

test('a page claiming two shapes resolves to the earlier reader', () => {
  // A table with rows *and* a menu's worth of links: the sheet reader is earlier
  // than the index reader, so the page is a sheet and not a menu.
  const html = `<body><div class="contentContainer">
    <table class="SimpleSD">
      <tr><th>Name</th><th>Total</th></tr>
      <tr><td>Ada</td><td>12</td></tr>
      <tr><td>Grace</td><td>7</td></tr>
    </table>
    ${Array.from({ length: 8 }, (_, i) => `<a href="/admin.sd?page=Page${i}">Page ${i}</a>`).join('')}
  </div></body>`;

  const model = readPage(doc(html), 'https://app.thestudiodirector.com/studio1/admin.sd?page=HomePage');
  assert.equal(model.view, 'sheet');
  assert.equal(model.index, null, 'the later reader never ran');
});

test('the model keeps one key per reader, all present', () => {
  const model = readPage(doc('<body><div class="contentContainer"><p>nothing here</p></div></body>'),
    'https://app.thestudiodirector.com/studio1/admin.sd?page=Whatever');

  for (const key of ['nav', 'week', 'list', 'report', 'task', 'sheet', 'index', 'settings', 'note', 'confirm']) {
    assert.ok(key in model, key + ' is present');
  }
  assert.equal(model.view, null, 'an unclaimed page is left to the app');
});

test('a confirmation keeps the record list it arrived with', () => {
  // The goldens pin this: `list` is gated by the week, not by the confirmation,
  // so the sentence and the panel it sits beside are both in the model.
  const html = `<body><div class="Content">
    <div class="formTitle"></div>
    <div>Lovelace Family has been updated.</div>
    <div id="idSearchSpan"><div class="searchResultList"><div class="searchResultItem">Ada</div></div></div>
  </div></body>`;

  const model = readPage(doc(html), 'https://app.thestudiodirector.com/studio1/admin.sd');
  assert.equal(model.view, 'confirm');
  assert.equal(model.confirm.ok, true);
  assert.ok(model.list, 'the panel beside the sentence is still read');
});

test('the five entry points are one decision', () => {
  const base = 'https://app.thestudiodirector.com/studio1/admin.sd';

  // Its rows are drawn by the app's own script, so it is read live even though
  // it is not a record page.
  assert.equal(routeOf(base + '?page=SearchResults'), 'search');

  // A record parameter, whatever the page name is.
  assert.equal(routeOf(base + '?page=EditClass&cident=101'), 'record');
  // And a record page name without one.
  assert.equal(routeOf(base + '?page=EditStudent'), 'record');

  // The save response: no page name, already in the browser, never fetched.
  assert.equal(routeOf(base), 'admin');

  // Everything else is a page for the reader chain.
  assert.equal(routeOf(base + '?page=CalendarPage'), 'page');
  assert.equal(routeOf(base + '?page=HomePage&clicktab=Home'), 'page');

  assert.deepEqual(ROUTES, ['search', 'record', 'admin', 'page']);
});

test('the source choice prefers the live page and fetches only when it must', () => {
  // A reader claims the live page: no GET, no second parse.
  assert.equal(chooseSource({ liveView: { view: 'week' } }), 'live');
  // Nothing claimed, and the page is a shell the server was to fill in.
  assert.equal(chooseSource({ liveView: null, liveHasShell: false }), 'fetch');
  assert.equal(chooseSource({ liveView: null, liveIsEmpty: true }), 'fetch');
  // Nothing claimed, and the live page is simply not this build's screen.
  assert.equal(chooseSource({ liveView: null }), 'app');
  // No arguments at all is not a crash.
  assert.equal(chooseSource(), 'app');
});
