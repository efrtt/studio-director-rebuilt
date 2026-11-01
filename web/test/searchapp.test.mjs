// Search through the app's own entry point.
//
// The live search box carries `onkeypress="StudioDir.doSearchOnEnter(event)"`, and
// that handler tests charCode/which/keyCode. A synthetic KeyboardEvent cannot
// carry those legacy fields in every browser, so relying on Enter alone makes a
// search silently do nothing. The app's own doSearch() is called instead - it is
// still the app that navigates.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { runSearch } from '../src/lib/search.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const withBox = doc(`<body><form id="idForm" action="admin.sd" method="post">
  <input id="idPage" type="hidden" value="NewFamily">
  <div class="searchBox"><input type="text" id="idSearchText" onkeypress="StudioDir.doSearchOnEnter(event)"></div>
</form></body>`);

const withOtherBox = doc(`<body><form id="idForm" action="admin.sd" method="post">
  <input id="idPage" type="hidden" value="NewFamily">
  <div class="searchBox"><input type="text" id="someOtherSearch"></div>
</form></body>`);

const stubWindow = () => {
  const calls = [];
  return { calls, win: { StudioDir: { doSearch() { calls.push('doSearch'); } } } };
};

test('the app own search function is used when the page has one', () => {
  const { calls, win } = stubWindow();
  const result = runSearch(withBox, '  hopper  ', { window: win });

  assert.equal(result.submitted, true);
  assert.equal(result.via, 'app-search');
  assert.equal(result.query, 'hopper');
  assert.deepEqual(calls, ['doSearch'], 'called once, through the app');
});

test('a different search box is not driven by that function', () => {
  // doSearch() reads a fixed #idSearchText. On a page with another box it would
  // search the wrong thing, so the fallback rungs are used instead.
  const { calls, win } = stubWindow();
  const result = runSearch(withOtherBox, 'hopper', { window: win });
  assert.deepEqual(calls, [], 'the app function is not called');
  assert.notEqual(result.via, 'app-search');
});

test('a page with no search box still says so', () => {
  const result = runSearch(doc('<body><p>nothing</p></body>'), 'hopper');
  assert.equal(result.submitted, false);
  assert.equal(result.reason, 'no-box');
});
