// Short menus: a picker drawn as a list is a menu even with three links.
//
// The link count in `readIndex` exists to keep notices out of the tile view. This
// suite pins the one structural exception: links that are each alone in their own
// `<li>`, with nothing to fill in and no rows. `PrintClass` and `PrintFamily` are
// that shape and used to fall back to the app's bare wall of anchors; a notice is
// not, and must still fall back.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { readIndex } from '../src/lib/index-page.js';
import { readPage } from '../src/lib/page.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const picker = (links) => `<form id="idForm"><div class="contentContainer"><div class="Content">
  <div class="formTitle">Class Rosters</div>
  <ul>${links.map((n) => `<li><a href="admin.sd?page=PrintClass&cident=${n}">Roster ${n}</a></li>`).join('')}</ul>
</div></div></form>`;

test('three list items are a menu', () => {
  const model = readIndex(doc(picker([1, 2, 3])));

  assert.ok(model, 'a list of destinations is a menu');
  assert.equal(model.kind, 'index');
  assert.equal(model.count, 3);
  assert.deepEqual(model.groups.flatMap((g) => g.items.map((i) => i.label)),
    ['Roster 1', 'Roster 2', 'Roster 3']);
});

test('the page reads as a menu, not as an unclaimed page', () => {
  const model = readPage(doc(picker([1, 2, 3, 4, 5])),
    'https://app.thestudiodirector.com/studio1/admin.sd?page=PrintClass&cident=1782910697458');

  assert.equal(model.view, 'index');
  assert.equal(model.index.count, 5);
});

test('a notice with action links in a paragraph is not a menu', () => {
  // The shape Unenroll and PreapproveStudents have: a sentence, then links that
  // share a paragraph with each other and a control. Tiles would cover it.
  const notice = doc(`<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Drop Student</div>
    <p>Dropping the student takes them out of this class.</p>
    <p>
      <a href="admin.sd?page=EditStudent&sident=1">Back to the student</a>
      <a href="admin.sd?page=EditClass&cident=1">Back to the class</a>
      <a href="#" onclick="StudioDir.onCallMethodSubmit('Unenroll','confirm','a');return false;">Continue</a>
    </p>
  </div></div></form>`);

  assert.equal(readIndex(notice), null);
});

test('a list with something to fill in is not a menu either', () => {
  const withControl = doc(`<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Pick a roster</div>
    <ul>
      <li><a href="admin.sd?page=PrintClass&cident=1">Roster 1</a></li>
      <li><a href="admin.sd?page=PrintClass&cident=2">Roster 2</a></li>
      <li><a href="admin.sd?page=PrintClass&cident=3">Roster 3</a></li>
    </ul>
    <input id="search" name="search">
  </div></div></form>`);

  assert.equal(readIndex(withControl), null, 'a control means a task, not a menu');
});

test('two links are too few even in list items', () => {
  assert.equal(readIndex(doc(picker([1, 2]))), null);
});
