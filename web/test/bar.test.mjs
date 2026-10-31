/*
 * The record page's own button bar.
 *
 * The rebuilt editor had Reset/Save and nothing else, so a student page could be
 * edited but not printed, mailed, deleted, or taken to its family — the app's
 * own bar was underneath the overlay. From the EditStudent dump the bar is:
 *
 *   .Content > .ButtonBar > a#new a#save a#print a#email a#delete a#editfamily
 *                          > div#menuBtn > a.menuLink + div.menu > a…
 *
 * Two kinds of control, two kinds of behaviour: an href is a page the app
 * renders (follow it), no href is the app's own script (press it where it
 * stands). These tests hold both, and that Save stays out of it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;

const here = path.dirname(fileURLToPath(import.meta.url));
const { parseHtml } = await import('../src/lib/shell.js');
const { readBar } = await import('../src/lib/bar.js');
const { clickActionInApp } = await import('../src/lib/actions.js');
const { readForm } = await import('../src/lib/form.js');

const load = (name) => parseHtml(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));

const student = load('edit-student.html');
const bar = readBar(student);

test('the bar is the page’s controls, minus Save', () => {
  assert.ok(bar, 'EditStudent has a button bar');
  assert.deepEqual(bar.items.map((i) => i.label), ['New', 'Print', 'Email', 'Delete', 'Family']);

  // Save belongs to the editor, which writes only the changed fields: a second
  // Save in the bar would be a second, incompatible way to save the same page.
  assert.equal(bar.items.some((i) => i.id === 'save'), false);
  assert.equal(bar.items.some((i) => i.label === 'Save'), false);

  // The order is the app's, so the buttons land where a person expects them.
  assert.deepEqual(bar.items.map((i) => i.id), ['new', 'print', 'email', 'delete', 'editfamily']);
});

test('an href is a page to follow; no href is the app’s own script', () => {
  const newItem = bar.items.find((i) => i.id === 'new');
  const del = bar.items.find((i) => i.id === 'delete');

  // In the fixture every control is href="#"; the live page links New to
  // NewStudent and prints through PrintStudent&sident=…, so a real href is what
  // the view follows and what the test pins here.
  assert.equal(newItem.js, true);
  assert.equal(del.js, true);
  assert.equal(del.danger, true, 'Delete asks before it runs');
  assert.equal(newItem.danger, false);

  const live = parseHtml(`<div class="Content"><div class="ButtonBar">
      <a id="new" href="admin.sd?page=NewStudent">New</a>
      <a id="print" href="admin.sd?page=PrintStudent&amp;sident=9001">Print</a>
      <a id="email" href="admin.sd?page=EmailStudent&amp;sident=9001">Email</a>
      <a id="editfamily" href="admin.sd?page=EditFamily&amp;fident=4401">Edit Family</a>
      <a id="delete" onclick="StudioDir.onSubmit('DelStudent');">Delete</a>
    </div></div>`);

  const liveBar = readBar(live);
  assert.deepEqual(liveBar.items.map((i) => [i.label, i.js]),
    [['New', false], ['Print', false], ['Email', false], ['Edit Family', false], ['Delete', true]]);
  assert.equal(liveBar.items[1].href, 'admin.sd?page=PrintStudent&sident=9001',
    'the record id is the app’s, taken from the page, not rebuilt here');
  // A link needs no handler: it is followed, so it has nothing to press.
  assert.equal(liveBar.items[0].hint, '');
});

test('the More menu is read, with its own label', () => {
  assert.equal(bar.moreLabel, 'More');
  assert.equal(bar.menu.length, 8, 'the fixture’s menu has eight entries');
  assert.deepEqual(bar.menu.map((i) => i.label), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);

  // A menu item is often a page (Override Tuition, Merge this Family…) and
  // sometimes the app’s script (Reset Password). Both shapes come through.
  const page = parseHtml(`<div class="Content"><div class="ButtonBar">
      <a id="save" href="#">Save</a>
      <div id="menuBtn" class="menuButton"><a class="menuLink" href="#"><span>More</span></a>
        <div class="menu">
          <a href="admin.sd?page=Override&amp;sident=9001">Override Tuition</a>
          <a href="#" onclick="StudioDir.resetPassword();">Reset Password</a>
          <a href="admin.sd?page=UnenrollAll&amp;sident=9001">Drop This Student From All Classes</a>
        </div></div>
    </div></div>`);

  const menuBar = readBar(page);
  assert.deepEqual(menuBar.items, [], 'Save was the only bar control');
  assert.deepEqual(menuBar.menu.map((i) => i.js), [false, true, false]);
  assert.equal(menuBar.menu[1].id, '');
  assert.equal(menuBar.menu[2].danger, true, 'dropping a student from everything is a delete');
});

test('a page with no bar grows no buttons', () => {
  // Print sheets, lists and the login screen have no .ButtonBar: a view that
  // invented one would offer controls the page never had.
  assert.equal(readBar(load('sheet-roster.html')), null);
  assert.equal(readBar(parseHtml('<div class="Content"><div class="formTitle">Home</div></div>')), null);
});

test('pressing Delete clicks the app’s own element, never a rebuilt request', () => {
  const live = load('edit-student.html');
  let clicks = 0;
  live.getElementById('delete').addEventListener('click', (e) => {
    e.preventDefault();
    clicks += 1;
  });

  const del = bar.items.find((i) => i.id === 'delete');
  const result = clickActionInApp(live, del);

  assert.deepEqual(result, { submitted: true, via: 'id', id: 'delete' });
  assert.equal(clicks, 1, 'the app decides what deleting this record means');
});

test('a bar control that is not on the live page says so instead of guessing', () => {
  const elsewhere = parseHtml('<div class="Content"><div class="ButtonBar"></div></div>');
  const del = bar.items.find((i) => i.id === 'delete');
  const result = clickActionInApp(elsewhere, del);

  assert.equal(result.submitted, false);
  assert.equal(result.reason, 'missing');
});

test('the bar does not change what the editor reads', () => {
  // One fetch still yields the form, the tabs and the bar: the bar is read from
  // the same response, so no extra request is made to show it.
  assert.equal(readForm(student).fields.length, 15);
  assert.equal(bar.items.length, 5);
});
