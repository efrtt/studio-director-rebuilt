// The record ladder and the live re-read, out of main.js.
//
// Both were described in prose and checked by hand, because the ladder sat in
// the middle of the mounting code and the re-read is a timer. These tests are the
// difference: the order a record URL resolves in, and the loop that waits for a
// JS-drawn page, driven by a clock that does not sleep.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser } from 'linkedom';

import { readRecordPage, recordModel } from '../src/lib/record.js';
import { readLiveView } from '../src/lib/live.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');
const fixture = (name) => fs.readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');

const RECORD_URL = 'https://app.thestudiodirector.com/studio1/admin.sd?page=EditClass&cident=101';

test('a record page with a form and a Save is the editor', () => {
  const found = readRecordPage(doc(fixture('editor-family.html')), RECORD_URL);

  assert.ok(found, 'the page resolved to something');
  assert.equal(found.view, 'form');
  assert.equal(found.model.view, 'form');
  assert.ok(found.model.form, 'the form model is carried');
  assert.ok(Array.isArray(found.model.form.fields) && found.model.form.fields.length > 0);
});

test('a form with nothing that saves it is not an editor', () => {
  const page = doc(fixture('editor-family.html'));
  const save = page.getElementById('save');
  assert.ok(save, 'the fixture carries the app Save link');
  save.remove();

  assert.equal(recordModel(page, RECORD_URL), null, 'no editor without a save control');

  // And the ladder does not stop there: a record URL that is not an editor still
  // gets whichever reader claims the page, never a form view.
  const found = readRecordPage(page, RECORD_URL);
  assert.notEqual(found && found.view, 'form');
});

test('a record URL that is another screen resolves to that screen', () => {
  // `PrintClassRoster` carries a form-shaped wall of controls; the ladder must
  // give it to a table reader rather than build an editor out of it.
  const roster = readRecordPage(doc(fixture('sheet-roster.html')), RECORD_URL);
  assert.equal(roster && roster.view, 'sheet');

  // A menu of links behind a record URL is the index reader's.
  const menu = readRecordPage(doc(fixture('index-charges.html')), RECORD_URL);
  assert.equal(menu && menu.view, 'index');
});

test('a record URL with nothing any reader claims is left to the app', () => {
  const bare = doc('<body><div class="contentContainer"><div class="Content"><p>One sentence.</p></div></div></body>');
  assert.equal(readRecordPage(bare, RECORD_URL), null);
});

test('the live re-read costs no wait when the page is already readable', async () => {
  let sleeps = 0;
  const model = await readLiveView(doc(fixture('index-charges.html')), RECORD_URL, {
    maxWait: 1000,
    step: 100,
    now: () => 0,
    sleep: async () => { sleeps += 1; }
  });

  assert.equal(model && model.view, 'index');
  assert.equal(sleeps, 0, 'the first read answered');
});

test('the live re-read waits for a JS-drawn page, then stops', async () => {
  const page = doc('<body><div id="mainContent"><div class="contentContainer"></div></div></body>');
  const root = page.querySelector('.contentContainer');
  const links = Array.from({ length: 8 }, (_, i) => `<a href="admin.sd?page=Page${i}">Page ${i}</a>`).join('');

  let clock = 0;
  let sleeps = 0;
  const model = await readLiveView(page, RECORD_URL, {
    maxWait: 1000,
    step: 100,
    now: () => clock,
    sleep: async (ms) => {
      sleeps += 1;
      clock += ms;
      // The app's script fills the root on its second turn, not its first.
      if (sleeps === 2) root.innerHTML = links;
    }
  });

  assert.equal(model && model.view, 'index', 'the drawn page was read');
  assert.equal(sleeps, 2, 'and the loop stopped as soon as it was');
});

test('the live re-read gives up rather than waiting forever', async () => {
  const page = doc('<body><div id="mainContent"><div class="contentContainer"></div></div></body>');
  let clock = 0;
  let sleeps = 0;

  const model = await readLiveView(page, RECORD_URL, {
    maxWait: 300,
    step: 100,
    now: () => clock,
    sleep: async (ms) => { sleeps += 1; clock += ms; }
  });

  assert.equal(model, null, 'nothing was drawn');
  assert.equal(sleeps, 3, 'the budget was spent, not exceeded');
});
