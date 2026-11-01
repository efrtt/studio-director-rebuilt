/*
 * Landing pages: Charges & Payments, Communications, Advanced Search, Reports,
 * Settings.
 *
 * These are menus — nothing but links. The reader turns them into groups of
 * tiles, and must never steal a page that actually shows data or a form.
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
const { readIndex } = await import('../src/lib/index-page.js');
const { readPage } = await import('../src/lib/page.js');

const load = (name) => parseHtml(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));

const chargesDoc = load('index-charges.html');
const index = readIndex(chargesDoc);

test('a landing page becomes groups of links, in the app\'s order', () => {
  assert.ok(index, 'Charges & Payments is a menu');
  assert.equal(index.kind, 'index');
  assert.equal(index.title, 'Charges & Payments');

  assert.deepEqual(index.groups.map((g) => g.label), ['Charges', 'Payments', 'Settings']);
  assert.deepEqual(index.groups[0].items[0],
    { label: 'Enter new family charge', href: 'admin.sd?page=NewFamilyCharge' });
  assert.equal(index.count, 10);
  assert.equal(index.groups[1].items.length, 4);
});

test('the rail and breadcrumb are navigation, not menu items', () => {
  const labels = index.groups.flatMap((g) => g.items.map((i) => i.label));
  assert.equal(labels.includes('Home'), false);
  assert.equal(labels.includes('Reports'), false, 'the rail link is not an item');
  assert.equal(labels.includes('Charges & Payments'), false);
});

test('routing picks the index view for a menu page', () => {
  const page = readPage(chargesDoc, 'https://app.thestudiodirector.com/studio1/admin.sd?page=ChargesHome');
  assert.equal(page.view, 'index');
  assert.equal(page.title, 'Charges & Payments');
  assert.equal(page.index.count, 10);
  assert.equal(page.report, null);
  assert.equal(page.list, null);
});

test('a page that shows data is not a menu', () => {
  // The Home dashboard: links, but also a schedule table with rows.
  const home = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Home</div>
    <table class="ReportTable"><tr><th>Class</th></tr>
      <tr><td><a href="admin.sd?page=EditClass&cident=1">Ballet III</a></td></tr>
      <tr><td><a href="admin.sd?page=EditClass&cident=2">Jazz I</a></td></tr>
    </table>
    <a href="admin.sd?page=ReportsHome">Reports</a>
    <a href="admin.sd?page=ChargesHome">Charges</a>
    <a href="admin.sd?page=EmailTextHome">Communications</a>
    <a href="admin.sd?page=AdvSearch">Advanced Search</a>
    <a href="admin.sd?page=AdminHome">Settings</a>
    <a href="admin.sd?page=CalendarPage">Class Calendar</a>
  </div></div></form>`);

  assert.equal(readIndex(home), null);
  assert.equal(readIndex(load('calendar-page.html')), null, 'the week view keeps its own screen');
  assert.equal(readIndex(load('editor-class.html')), null, 'a list plus form is not a menu');
  assert.equal(readIndex(load('report-roster.html')), null, 'a report keeps its filters');
});

test('a page with only a few links is left to the app', () => {
  const sparse = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Manage Google</div>
    <a href="admin.sd?page=NewGoogle">Connect</a>
    <a href="admin.sd?page=GoogleHelp">Help</a>
  </div></div></form>`);
  assert.equal(readIndex(sparse), null);
});

test('a picker with thousands of links is a screen, not a refusal', () => {
  // Enroll(cident) is 4,271 student links in the real crawl; 900 here keeps the
  // fixture quick to parse and proves the same thing.
  const links = Array.from({ length: 900 },
    (_, i) => `<a href="admin.sd?page=Enroll&sident=${100000 + i}&cident=77">Student ${i}</a>`).join('\n');
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer">
      <div class="Content"><div class="formTitle">Enroll Student</div>
      ${links}
    </div></div></form>`);

  const read = readIndex(doc);
  assert.ok(read, 'the page is read, not refused');
  assert.equal(read.count, 900);
  assert.equal(read.limit, 300, 'the view draws 300 at a time');
  assert.equal(read.truncated, true);
  // Every link is kept, so the filter can search all of them.
  assert.equal(read.groups[0].items.length, 900);
  assert.equal(readPage(doc, 'https://x/admin.sd?page=Enroll&cident=77').view, 'index');
});

test('javascript and placeholder links are not menu items', () => {
  const doc = load('index-charges.html');
  const block = doc.querySelector('.sectionBlock');
  const fake = doc.createElement('a');
  fake.setAttribute('href', '#');
  fake.textContent = 'Not a destination';
  block.appendChild(fake);

  const read = readIndex(doc);
  const labels = read.groups.flatMap((g) => g.items.map((i) => i.label));
  assert.equal(labels.includes('Not a destination'), false);
  assert.equal(read.count, 10);
});

test('a menu whose category titles sit beside its lists keeps them', () => {
  // The Settings menu as the app draws it: the title is a bold line before the
  // list, not a heading wrapped around it. All 117 links used to land in one
  // group called "Links" because the reader only looked up the family tree.
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Settings</div>
    <div class="contentInfo">
      <div class="menuBlock"><b>Logins / Passwords / Security</b>
        <ol>
          <li><a href="admin.sd?page=AddStaffUser">Add Staff User-Account</a></li>
          <li><a href="admin.sd?page=ResetStaffPwd">Reset Admin/Staff Password</a></li>
        </ol>
      </div>
      <div class="menuBlock"><b>Class / Date Administration</b>
        <ol>
          <li><a href="admin.sd?page=Seasons">Seasons</a></li>
          <li><a href="admin.sd?page=Holidays">Holidays</a></li>
          <li><a href="admin.sd?page=ClassTypes">Class Types</a></li>
        </ol>
      </div>
    </div>
  </div></div></form>`);

  const read = readIndex(doc);
  assert.ok(read, 'a page of categorized lists is a menu');
  assert.deepEqual(read.groups.map((g) => g.label),
    ['Logins / Passwords / Security', 'Class / Date Administration']);
  assert.deepEqual(read.groups.map((g) => g.items.length), [2, 3]);
  assert.equal(read.count, 5);
  // The page title names the page, not a category of links.
  assert.equal(read.groups.some((g) => g.label === 'Settings'), false);
});

test('a title inside a list item is that link’s words, not a category', () => {
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Reports</div>
    <ul>
      <li><a href="admin.sd?page=Roster"><strong>Class roster</strong></a></li>
      <li><a href="admin.sd?page=Attendance"><strong>Attendance</strong></a></li>
      <li><a href="admin.sd?page=Balances"><strong>Balances</strong></a></li>
    </ul>
  </div></div></form>`);

  const read = readIndex(doc);
  assert.ok(read);
  assert.deepEqual(read.groups.map((g) => g.label), ['Links']);
  assert.deepEqual(read.groups[0].items.map((i) => i.label),
    ['Class roster', 'Attendance', 'Balances']);
});
