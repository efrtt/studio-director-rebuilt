// The global search's read.
//
// Measured on the live app: searching navigates to
// `admin.sd?page=SearchResults&searchText=…`, but the document still holds the
// record panel of the page the search started from while the app draws the
// results. Reading once mounted that leftover list, so a search from Families or
// Students looked like it had shown the first 500 families.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { readLiveView } from '../src/lib/live.js';
import { looksLikeSearchResults, searchReady } from '../src/lib/choose.js';
const { panelPeek } = await import('../src/lib/list.js');
import { readPage } from '../src/readers/index.js';

const URL_OF = 'https://app.thestudiodirector.com/srvda/admin.sd?page=SearchResults&searchText=B';

const row = (label, href) => `<div class="searchResultItem"><a href="${href}">${label}</a></div>`;

const panel = (heading, rows) => `<div id="idSearchSpan" class="searchResultPanel">
  <div class="searchResultBar"><div class="searchResultLabel">${heading}</div></div>
  <div class="searchResultList">${rows.join('')}</div>
</div>`;

const leftovers = `<body><div id="mainContent">
  <div class="formTitle">New Family</div>
  ${panel('Families', [row('Lovelace Family', 'admin.sd?page=EditFamily&fident=1')])}
</div></body>`;

const results = `<body><div id="mainContent">
  <div class="formTitle">Search Results for "B"</div>
  ${panel('2 Items', [
    row('Lovelace Family', 'admin.sd?page=EditFamily&fident=1'),
    row('Ada Lovelace', 'admin.sd?page=EditStudent&sident=2')
  ])}
</div></body>`;

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

test('a record panel is not search results', () => {
  const stale = readPage(doc(leftovers), URL_OF);
  assert.equal(looksLikeSearchResults(stale), false, 'the leftover list is refused');

  const found = readPage(doc(results), URL_OF);
  assert.equal(looksLikeSearchResults(found), true);
});

test('the wait asks a cheap look at the panel, not a whole read', () => {
  // The live search panel holds thousands of rows: reading all of them on every
  // tick is what starved the page and left the skin late or missing. One row, the
  // stated total and the page's own title answer the same question.
  const peek = panelPeek(doc(results));
  assert.equal(peek.view, 'list');
  assert.equal(peek.list.title, 'Search Results for "B"');
  assert.equal(peek.list.total, 2);
  assert.equal(peek.list.items.length, 1, 'the first row is enough');
  assert.equal(peek.list.items[0].href, 'admin.sd?page=EditFamily&fident=1');

  // And it answers the readiness question the same way the full model does.
  assert.equal(searchReady(peek, panelPeek(doc(leftovers))), true, 'a different record set is the results');
  assert.equal(searchReady(panelPeek(doc(leftovers)), panelPeek(doc(leftovers))), false,
    'the panel the page arrived with is never ready');

  // A page with no panel at all is not a list.
  assert.deepEqual(panelPeek(doc('<body><p>nothing</p></body>')).list, null);
});

test('the wait outlasts the leftovers and mounts the results', async () => {
  // A document that starts as the old page and becomes the results page, like the
  // app replacing the panel after its own request lands.
  const dom = doc(leftovers);
  const main = dom.querySelector('#mainContent');
  let ticks = 0;

  const model = await readLiveView(dom, URL_OF, {
    maxWait: 5000,
    step: 100,
    ready: looksLikeSearchResults,
    now: () => ticks * 100,
    sleep: async () => {
      ticks += 1;
      if (ticks === 2) main.innerHTML = doc(results).querySelector('#mainContent').innerHTML;
    }
  });

  assert.ok(model, 'a model came back');
  assert.equal(model.list.items.length, 2, 'the results, not the leftover panel');
  assert.match(model.list.label, /^Search Results/, 'and it is named as the results');
});

test('without results, the first reading still comes back', () => {
  // The fallback in mountSearchResults reads the page as it stands, so the app is
  // never covered with nothing.
  const page = readPage(doc(leftovers), URL_OF, { allowEmpty: true });
  assert.equal(page.view, 'list');
  assert.equal(page.list.items.length, 1);
});
