/*
 * Tests for src/lib/choose.js — which reading of a page gets mounted.
 *
 * These are the two rules that took 11 of the 61 notice shapes to get right, and
 * they lived inline in main.js until now, where nothing could test them:
 *
 *   - a note is only trusted when the live page agrees with it;
 *   - a page with no view at all gets one more look, if it carries a form.
 *
 * The seven cases below are every combination the wiring can be in. A rewrite
 * that changes any of them fails here rather than on somebody's screen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wantsLiveLook, decideMount, decideShellLess, hasReadyView } from '../src/lib/choose.js';

test('a note the live page agrees with is mounted straight away', () => {
  // No second look: this is the case that must stay free, or every notice pays
  // 1.5 s for a check that cannot change its mind. `decideMount` is deliberately
  // not consulted here — it only answers once a look has been taken, which is
  // why a note with no live view reads as "leave the app alone" below.
  assert.equal(wantsLiveLook({ fetchedView: 'note', contradicts: false }), false);
});

test('a note the live page contradicts gets a second look', () => {
  assert.equal(wantsLiveLook({ fetchedView: 'note', contradicts: true }), true);
});

test('a contradicted note with a live view mounts the live page', () => {
  // ChargesHome: the fetched copy was a notice, the live page is an 18-link menu.
  const decision = decideMount({ fetchedView: 'note', liveView: 'index' });
  assert.equal(decision.source, 'live');
});

test('a contradicted note that nothing claims leaves the app alone', () => {
  // Unenroll: a real form, no reader for it. A stale sentence over a working
  // form is worse than no overlay, so no overlay.
  const decision = decideMount({ fetchedView: 'note', liveView: null });
  assert.equal(decision.source, 'app');
});

test('a page with no view gets one more look only when it carries a form', () => {
  assert.equal(wantsLiveLook({ fetchedView: null, hasForm: true }), true);
  assert.equal(wantsLiveLook({ fetchedView: null, hasForm: false }), false);
});

test('no view in either reading mounts the fetched page, and says "none"', () => {
  const decision = decideMount({ fetchedView: null, liveView: null });
  assert.equal(decision.source, 'fetched');
  assert.equal(decision.state, 'none');
});

test('a page that already has a view never takes the extra look', () => {
  assert.equal(wantsLiveLook({ fetchedView: 'sheet', hasForm: true }), false);
  assert.equal(decideMount({ fetchedView: 'sheet', liveView: 'note' }).source, 'fetched');
});

/*
 * Print windows: no shell, no rail, no top bar — and often no `form#idForm` at
 * all, which is why `readPage` refuses them and this separate rule exists. The
 * branch used to be `print && querySelector('.formTitle, .ReportName')` inline
 * in main.js, where nothing could test it.
 */
test('a print window with a table and a title is a sheet', () => {
  assert.equal(decideShellLess({ hasSheet: true, hasTitle: true }), 'sheet');
});

test('a print window whose table reader declines is not a screen', () => {
  assert.equal(decideShellLess({ hasSheet: false, hasTitle: true }), 'none');
});

test('a shell-less page with no title stays with the app', () => {
  // One table and no name is not enough to cover the popup with an overlay.
  assert.equal(decideShellLess({ hasSheet: true, hasTitle: false }), 'none');
});

/*
 * The live re-read's stop condition. A note is excluded on purpose: if the live
 * page still reads as a notice, waiting longer cannot improve the answer.
 */
test('any readable view ends the live wait', () => {
  for (const view of ['week', 'list', 'sheet', 'index', 'task', 'settings']) {
    assert.equal(hasReadyView({ [view]: {} }), true, view + ' should end the wait');
  }
});

test('a live page that still reads as a note does not end the wait', () => {
  assert.equal(hasReadyView({ note: { lines: ['x'] } }), false);
  assert.equal(hasReadyView(null), false);
  assert.equal(hasReadyView({}), false);
});
