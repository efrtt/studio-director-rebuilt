// The search route's wait, against the shape that actually failed.
//
// Reported from the live app in Firefox: the URL had reached
// `?page=SearchResults&searchText=lily`, the app showed "31 Items" / 31 rows, and
// the skin showed "500 of 4291" - the request page's panel read after the title
// had changed but before the app redrew the rows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { searchSettled } from '../src/lib/choose.js';
import { keepWidest, isComplete } from '../src/lib/follow.js';
import { readPage } from '../src/readers/index.js';

const URL_OF = 'https://app.thestudiodirector.com/srvda/admin.sd?page=SearchResults&searchText=lily';

const row = (label, href) => `<div class="searchResultItem"><a href="${href}">${label}</a></div>`;

const page = (title, heading, count, href) => new DOMParser().parseFromString(`<body>
  <div class="Content"><div class="formTitle">${title}</div></div>
  <div id="idSearchSpan" class="searchResultPanel">
    <div class="searchResultBar"><div class="searchResultLabel">${heading}</div></div>
    <div class="searchResultList">${Array.from({ length: count }, (_, i) => row('Record ' + i, href + i)).join('')}</div>
  </div>
</body>`, 'text/html');

const model = (dom) => readPage(dom, URL_OF, { allowEmpty: true });

test('the leftover panel with the results title is not settled', () => {
  // Title already says results; the panel is still the 4291-record family list.
  const mixed = model(page('Search Results for "lily"', '4291 Items', 500, 'admin.sd?page=EditFamily&fident='));
  assert.equal(mixed.list.total, 4291);
  assert.equal(searchSettled(mixed, mixed), false, 'still the request page panel');
});

test('a panel that reached its own total is settled', () => {
  const done = model(page('Search Results for "lily"', '31 Items', 31, 'admin.sd?page=EditFamily&fident='));
  assert.equal(searchSettled(done, done), true, '31 of 31 is the answer');
});

test('a panel the app redrew is settled, even mid-fill', () => {
  const first = model(page('Search Results for "lily"', '4291 Items', 500, 'admin.sd?page=EditFamily&fident='));
  const redrawn = model(page('Search Results for "lily"', '2114 Items', 500, 'admin.sd?page=EditStudent&sident='));
  assert.equal(searchSettled(redrawn, first), true, 'a different total means a different record set');
});

test('a smaller, different list is adopted, not refused as a shrink', () => {
  // The bug behind the stuck screen: 31 real results against 500 leftovers was
  // treated as "the panel emptied itself" and the leftovers were kept.
  const leftovers = { items: new Array(500).fill({ label: 'Family' }), total: 4291 };
  const results = { items: new Array(31).fill({ label: 'Result' }), total: 31 };

  assert.equal(keepWidest(leftovers, results), results);
  assert.equal(isComplete(results), true);
});

test('the same record set still only ever grows', () => {
  const held = { items: [{ label: 'A' }, { label: 'B' }], total: 2114 };
  assert.equal(keepWidest(held, { items: [{ label: 'A' }], total: 2114 }), held, 'mid-redraw is not a shrink');
  assert.equal(keepWidest(held, { items: [], total: null }), held);
});
