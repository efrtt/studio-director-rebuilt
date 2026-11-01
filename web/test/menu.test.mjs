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

// The picker beside the list menu: a few distinct destinations, each offered once.
const choices = (links, prose) => `<form id="idForm"><div class="contentContainer"><div class="Content">
  <div class="Breadcrumb"><a href="admin.sd?page=HomePage">Home</a></div>
  <div class="formTitle">Email Class</div>
  <div class="contentInfo"><p>${prose}</p><ul>
  ${links.map((page) => `<li><a href="admin.sd?page=${page}">${page}</a></li>`).join('')}
  </ul><input type="hidden" name="cident" value="1"></div>
</div></div></form>`;

test('a short picker of distinct destinations is a menu', () => {
  const model = readIndex(doc(choices(['NewClass', 'EditClass', 'SendEmail', 'EmailClass'], 'Choose who should receive this message.')));

  assert.ok(model, 'four distinct destinations are a menu');
  assert.equal(model.count, 4);
});

test('a page that repeats one destination is left to the app', () => {
  // SendEmail: four links to SendEmail with different parameters, plus one other,
  // on nearly 200 characters of prose. This is the page the user asked to keep
  // unskinned, so it is pinned here rather than left to chance.
  const long = 'Compose a message, choose a subject line, pick recipients and review everything before the app sends it to the people selected on the previous screen.';
  const sendEmail = doc(`<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="Breadcrumb"><a href="admin.sd?page=HomePage">Home</a></div>
    <div class="formTitle">Send Email</div>
    <div class="contentInfo"><p>${long}</p><ul>
      <li><a href="admin.sd?page=EmailTextHome">Templates</a></li>
      <li><a href="admin.sd?page=SendEmail&totype=Instructor&iident=1">Compose</a></li>
      <li><a href="admin.sd?page=SendEmail&totype=Class&cident=1">Send to a class</a></li>
      <li><a href="admin.sd?page=SendEmail&meth=send&tid=1">Send this</a></li>
    </ul><input type="hidden" name="iident" value="1"></div>
  </div></div></form>`);

  assert.equal(readIndex(sendEmail), null);
  assert.equal(readPage(sendEmail, 'https://app.thestudiodirector.com/studio1/admin.sd?page=SendEmail&totype=Instructor&iident=1').view, null);
});
