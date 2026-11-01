// Following the app's record panel, and picking the right panel.
//
// Both rules came from the live SearchResults page: the panel announced
// "2114 Items" but the first paint held 500 rows, and a record panel from the
// page searched from was still in the document. A snapshot froze the list at
// 500 and the first panel in document order was the wrong one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { readList } from '../src/lib/list.js';
import { keepWidest, isComplete } from '../src/lib/follow.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');
const row = (label, href) => `<div class="searchResultItem"><a href="${href}">${label}</a></div>`;
const panel = (heading, rows) => `<div id="idSearchSpan" class="searchResultPanel">
  <div class="searchResultBar"><div class="searchResultLabel">${heading}</div></div>
  <div class="searchResultList">${rows.join('')}</div>
</div>`;
const listOf = (html) => readList(doc(`<body><div id="mainContent">${html}</div></body>`),
  'https://app.thestudiodirector.com/studio1/admin.sd?page=SearchResults');

test('a shorter reading is the panel mid-redraw, not a shorter list', () => {
  const held = { items: [{ label: 'A' }, { label: 'B' }], total: 2114 };
  assert.equal(keepWidest(held, { items: [], total: 2114 }), held);
  assert.equal(keepWidest(held, { items: [{ label: 'A' }], total: 2114 }), held);
});

test('the wider reading is taken, and the total is never lost', () => {
  const held = { items: [{ label: 'A' }], total: 2114 };
  const wider = keepWidest(held, { items: [{ label: 'A' }, { label: 'B' }], total: null });
  assert.equal(wider.items.length, 2);
  assert.equal(wider.total, 2114, 'a panel that has stopped counting still has a total');

  const counting = keepWidest({ items: [{ label: 'A' }], total: null }, { items: [{ label: 'A' }], total: 9 });
  assert.equal(counting.total, 9, 'a total learned later is kept');
});

test('the wait ends only when the panel reaches its own total', () => {
  assert.equal(isComplete({ items: new Array(500).fill(0), total: 2114 }), false);
  assert.equal(isComplete({ items: new Array(2114).fill(0), total: 2114 }), true);
  assert.equal(isComplete({ items: new Array(500).fill(0), total: null }), false);
  assert.equal(isComplete(null), false);
});

test('the results panel wins over a record panel left on the page', () => {
  const model = listOf(
    panel('Families', [row('Lovelace Family', 'admin.sd?page=EditFamily&fident=1')]) +
    panel('2114 Items', [
      row('Lovelace Family', 'admin.sd?page=EditFamily&fident=1'),
      row('Ada Lovelace', 'admin.sd?page=EditStudent&sident=2')
    ])
  );
  assert.equal(model.total, 2114, 'the count belongs to the results panel');
  assert.equal(model.items.length, 2);
  assert.equal(model.mixed, true);
});

test('a page with one panel reads exactly as it always did', () => {
  const model = listOf(panel('2114 Items', [
    row('Lovelace Family', 'admin.sd?page=EditFamily&fident=1'),
    row('Ada Lovelace', 'admin.sd?page=EditStudent&sident=2')
  ]));
  assert.equal(model.total, 2114);
  assert.equal(model.truncated, true, 'two rows of 2114 is still a window');
  assert.equal(model.label, 'Search Results', 'a count is not a name; the page title is');
});
