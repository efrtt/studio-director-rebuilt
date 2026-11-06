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
import { liveIsBare } from '../src/lib/shell.js';
import { readForm, hasForm } from '../src/lib/form.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

test('the registry order is the contract, most specific first', () => {
  assert.deepEqual(READERS.map((r) => r.id), [
    // The editor first: a record URL that is an editor must not be claimed by
    // the week reader, which would otherwise take the class editor's hidden
    // Calendar tab, or by the list reader, which would take its record panel.
    'editor',
    'confirmation', 'week', 'list',
    // The app's own attendance field names the register, so it is read before
    // the form readers that would otherwise take a dateless register as a task.
    'attendance',
    'report', 'task', 'insights', 'trends',
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

  for (const key of ['nav', 'week', 'list', 'report', 'task', 'insights', 'trends', 'sheet', 'index', 'settings', 'note', 'confirm']) {
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

test('a live page with nothing in it is the one case worth fetching', () => {
  const shell = (inner) => doc(`<body><div id="mainContent"><div class="contentContainer">${inner}</div></div></body>`);

  // A reader's raw material: rows, controls, links or prose.
  assert.equal(liveIsBare(shell('<table><tr><td>Ada</td></tr></table>')), false);
  assert.equal(liveIsBare(shell('<input id="name" value="Ada">')), false);
  assert.equal(liveIsBare(shell('<a href="/admin.sd?page=HomePage">Home</a>')), false);
  assert.equal(liveIsBare(shell('<p>Choose a family.</p>')), false);

  // An empty content root is the JS-drawn page before its script runs.
  assert.equal(liveIsBare(shell('')), true);
  // No content root at all: a print popup, or a page that is not the app's.
  assert.equal(liveIsBare(doc('<body><p>bare</p></body>')), true);
  // Our own overlay is in the tree once a view is mounted: not content.
  assert.equal(liveIsBare(shell('<div id="sd-root"><p>rebuilt</p></div>')), true);
});

test('an editor is read where it stands, and an empty select is still skipped', () => {
  // Reading the live page is about the tree the edits are written into (and one
  // request less), not about recovering fields: an empty select cannot be
  // edited either way, so it is dropped from the live page just as from a copy.
  const editor = (label1, label2) => doc(`<body><a id="save" href="#">Save</a><table class="Form">
    <tr><td>Guardian</td><td><input id="guardian" name="guardian" type="text" value="Ada"></td></tr>
    <tr><td>Phone 1</td><td>${label1}<input id="phone1" name="phone1" type="text"></td></tr>
    <tr><td>Phone 2</td><td>${label2}<input id="phone2" name="phone2" type="text"></td></tr>
    <tr><td>Email</td><td><input id="email" name="email" type="text"></td></tr>
  </table></body>`);
  const filled = (n) => `<select name="phone${n}_label"><option>Home</option><option>Work</option></select>`;
  const empty = (n) => `<select name="phone${n}_label"></select>`;

  // The live page: every control is editable, so every field is offered.
  const live = editor(filled(1), filled(2));
  assert.equal(hasForm(live), true);
  assert.equal(readForm(live).fields.length, 6);

  // The same page with the two selects empty (the class page's date pickers
  // arrive that way): they are skipped, and the smaller count is the right one.
  const copy = editor(empty(1), empty(2));
  assert.equal(readForm(copy).fields.length, 4);
  // Still a form, so the fetch fallback still knows what it is looking at.
  assert.equal(hasForm(copy), true);

  // A table page is not an editor, and must not be claimed as one.
  assert.equal(hasForm(doc('<body><table class="ReportTable"><tr><td>Ada</td></tr></table></body>')), false);
});
