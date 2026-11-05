// The search route's wait, against the shape that actually failed.
//
// Reported from the live app in Firefox: the URL had reached
// `?page=SearchResults&searchText=lily`, the app showed "31 Items" / 31 rows, and
// the skin showed "500 of 4291" - the request page's panel read after the title
// had changed but before the app redrew the rows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { searchSettled, searchReady, sameRecordSet } from '../src/lib/choose.js';
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

// A search started from a list page. The results page is served carrying that
// page's record panel, and the app finishes filling that panel *before* it draws
// the results — so the carried list reaches its own total first. Reported live
// from the Students list: searching showed the students list, under the search
// URL, and searching again worked.
const carried = (count, total, extra = []) => ({
  list: {
    label: 'Search Results for "lily"',
    title: 'Search Results for "lily"',
    total,
    items: Array.from({ length: count }, (_, i) => ({ label: 'Record ' + i, href: 'admin.sd?page=EditStudent&sident=' + i }))
      .concat(extra)
  }
});

test('a carried panel that fills to its own total is not the results', () => {
  const first = carried(2, 3);
  const filled = carried(3, 3);
  // The old test would have accepted it: the panel had reached its own total.
  assert.equal(searchSettled(filled, first), true, 'it does reach its total');
  assert.equal(sameRecordSet(filled.list, first.list), true, 'and it is still the same record set');
  assert.equal(searchReady(filled, first), false, 'so the wait continues');
});

test('a search that found nothing does not wait for a change', () => {
  // 0 of 0 is the answer, and an empty panel is not "the set we arrived with".
  const first = carried(3, 3);
  const empty = { list: { label: '0 Items', title: 'Search Results for "lily"', total: 0, items: [] } };
  assert.equal(searchReady(empty, first), true);
  assert.equal(searchReady(empty, { list: { label: '0 Items', title: 'Search Results for "lily"', total: 0, items: [] } }), true);
});

test('the results are ready once a different record set lands', () => {
  const first = carried(2, 4272);
  const done = { list: { label: '31 Items', title: 'Search Results for "lily"', total: 31, items: [{ label: 'Ada Student', href: 'admin.sd?page=EditStudent&sident=9' }] } };
  assert.equal(searchReady(done, first), true);
});

test('the first rows of the results are enough to mount them', () => {
  // The app draws its results a window at a time; the list follows the panel to
  // the total itself, so the screen must not wait for the last of 8230 rows.
  const first = carried(3, 3);
  const drawing = { list: { label: '8230 Items', title: 'Search Results for "lily"', total: 8230, items: [{ label: 'Ada Student', href: 'admin.sd?page=EditStudent&sident=9' }] } };
  assert.equal(searchReady(drawing, first), true);
});

test('the same count of a different record set is the results too', () => {
  const first = carried(1, 1);
  const done = { list: { label: '1 Items', title: 'Search Results for "lily"', total: 1, items: [{ label: 'Ada Student', href: 'admin.sd?page=EditStudent&sident=9' }] } };
  assert.equal(searchReady(done, first), true, 'a different first record is a different set');
});

test('a page without the results title is never ready', () => {
  const first = carried(2, 1);
  const other = { list: { label: 'Students', title: 'New Student', total: 1, items: [{ label: 'Ada Student', href: 'x' }] } };
  assert.equal(searchReady(other, first), false);
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
