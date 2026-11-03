/*
 * The record pages' tab panels.
 *
 * One fetch of EditClass returns the Overview form *and* the Enrollment, Skills
 * and Calendar panels, hidden with display:none. These tests pin what each panel
 * yields, so a rebuilt tab cannot silently lose its rows.
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
const { readTabs } = await import('../src/lib/tabs.js');

const load = (name) => parseHtml(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));

const classDoc = load('edit-class.html');
const tabs = readTabs(classDoc);

test('a record page exposes its tab strip in order', () => {
  assert.ok(tabs, 'EditClass has tabs');
  assert.deepEqual(tabs.tabs.map((t) => t.label), ['Overview', 'Enrollment', 'Skills', 'Calendar']);
  // The live strip marks the selected tab with `selectedTab` and no `tab`
  // class. If that one is dropped, every label shifts up one place and the
  // editor shows the Overview form under the Enrollment label.
  assert.equal(tabs.tabs[0].selected, true, 'Overview is the selected tab');
  assert.equal(tabs.tabs[1].label, 'Enrollment');
  assert.equal(tabs.tabs[1].selected, false);
  assert.equal(tabs.tabs[0].kind, 'form', 'the first tab is the editor itself');
  assert.deepEqual(tabs.tabs[0].blocks, [], 'the form table is not read as a panel');

  assert.equal(tabs.tabs[1].kind, 'table');
  assert.equal(tabs.tabs[1].key, 'enrollment');
  assert.equal(tabs.tabs[1].label, 'Enrollment');
});

test('a strip whose first tab has no id still maps to the first panel', () => {
  const doc = parseHtml(`<div class="tabContainer">
      <div class="selectedTab">Overview</div>
      <div class="tab">Enrollment</div>
    </div>
    <div class="tabContent" id="tab-content-1"><table><tr><th>A</th></tr><tr><td>1</td></tr></table></div>
    <div class="tabContent" id="tab-content-2"><table><tr><th>B</th></tr><tr><td>2</td></tr></table></div>`);

  const read = readTabs(doc);
  assert.deepEqual(read.tabs.map((t) => t.label), ['Overview', 'Enrollment']);
  assert.equal(read.tabs[0].kind, 'form', 'the unlabelled first tab is the record');
  assert.equal(read.tabs[1].blocks[0].headings[0], 'B', 'position, not id, picks the panel');
});

test('the enrollment panel keeps its columns, rows and links', () => {
  const enrollment = tabs.tabs[1];
  assert.equal(enrollment.blocks.length, 2, 'current students and the waitlist');

  const roster = enrollment.blocks[0];
  // The panel opens with the app's own "Add student" / "Tags" bar. It is a
  // control, not the table's name, so a heading lookup must not take it.
  assert.equal(roster.section, '');
  assert.deepEqual(roster.headings,
    ['First Name', 'Last Name', 'Age', 'Gender', 'Performing', 'Family', 'Actions']);
  assert.equal(roster.rows.length, 1);
  assert.equal(roster.rows[0][0].text, 'Ada');
  assert.equal(roster.rows[0][0].href, 'admin.sd?page=EditStudent&sident=9001');
  assert.equal(roster.rows[0][5].text, 'Lovelace');
  assert.equal(roster.rows[0][5].href, 'admin.sd?page=EditFamily&fident=4401');
  assert.equal(roster.rows[0][6].right, true, 'the Actions column keeps its alignment');

  const waitlist = enrollment.blocks[1];
  assert.equal(waitlist.section, 'Waitlist', 'the class lookup still wins where the app classes its heading');
  assert.deepEqual(waitlist.rows, []);
  assert.match(enrollment.note, /Waitlist: nothing here yet/);
});

test('panel buttons are named, and the ones the app drives are marked', () => {
  const enrollment = tabs.tabs[1];
  assert.deepEqual(enrollment.actions.map((a) => a.label), ['Add student', 'Tags']);
  assert.equal(enrollment.actions[0].js, true, 'href="#" means the app\'s own script');
});

test('a table wrapped in extra divs is still found', () => {
  // The family page's Students tab nests its roster two divs deep.
  const family = readTabs(load('edit-family.html'));
  const students = family.tabs.find((t) => t.label === 'Students');
  assert.ok(students, 'Students is the second tab');
  assert.equal(students.blocks.length, 1);
  assert.equal(students.blocks[0].headings[0], 'First Name');
  assert.equal(students.blocks[0].rows[0][0].text, 'Ada');
  assert.equal(students.blocks[0].rows[0][0].href, 'admin.sd?page=EditStudent&sident=9001');
});

test('an empty panel says so instead of rendering nothing', () => {
  const skills = tabs.tabs[2];
  assert.deepEqual(skills.blocks[0].headings, ['Level', 'Skill Category', 'Name', 'Actions']);
  assert.deepEqual(skills.blocks[0].rows, []);
  assert.equal(skills.note, 'No skills.');
});

test('the calendar panel keeps one block per weekday table', () => {
  const calendar = tabs.tabs[3];
  assert.deepEqual(calendar.blocks.map((b) => b.headings[0]), ['Monday', 'Wednesday']);
});

test('pages without a tab strip get no tab bar', () => {
  assert.equal(readTabs(load('editor-class.html')), null, 'NewClass is a list plus form');
  assert.equal(readTabs(load('calendar-page.html')), null);
  assert.equal(readTabs(parseHtml('<div></div>')), null);
});

test('a heading the app does not class still labels its table', () => {
  // The live shape of a student's enrollment panel, dumped from
  // EditStudent&sident=…: each season's table is introduced by a
  // `div.MultiTable` that holds the season's name — the same class the app also
  // uses, empty, as a spacer between blocks. "Total Hours" sits after each table
  // and belongs to the table above it, not to the one below.
  const doc = parseHtml(`<div class="tabContainer">
      <div class="selectedTab">Overview</div>
      <div class="tab" id="tab-enrollment">Enrollment</div>
    </div>
    <div class="tabContent" id="tab-enrollment-content">
      <div><a id="addstudent" class="Btn" href="#">Enroll in New Class</a></div>
      <div class="MultiTable">Enrollment for Fall 2026-Spring 2027 (8/3/26-6/10/27)</div>
      <table class="SimpleSD"><tr><th>Day</th><th>Time</th></tr>
        <tr><td>Monday</td><td>4:00 PM</td></tr></table>
      <div class="WithinMultiTable">Total Hours: 11:45</div>
      <div class="MultiTable"></div>
      <div class="MultiTable">Enrollment for (Office Use Only) Dance Co. 2026-2027</div>
      <table class="SimpleSD"><tr><th>Day</th><th>Time</th></tr>
        <tr><td>Wednesday</td><td>6:00 AM</td></tr></table>
      <div class="WithinMultiTable">Total Hours: 0:40</div>
    </div>`);

  const read = readTabs(doc).tabs[1];
  assert.equal(read.blocks.length, 2);
  assert.equal(read.blocks[0].section, 'Enrollment for Fall 2026-Spring 2027 (8/3/26-6/10/27)');
  assert.equal(read.blocks[1].section, 'Enrollment for (Office Use Only) Dance Co. 2026-2027');
});
