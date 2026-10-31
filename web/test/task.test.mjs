/*
 * Form screens that are not records and not reports.
 *
 * From the crawl: 47 of these — compose mail, select classes to mail, print
 * statements, the wizards. The adapter reads the fields like the editor does and
 * offers the page's own controls, so pressing one sends the page through the app
 * rather than posting from here.
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
const { readTask, runTaskInApp } = await import('../src/lib/task.js');
const { readPage } = await import('../src/lib/page.js');
const { clickActionInApp, readActions, primaryAction } = await import('../src/lib/actions.js');

const load = (name) => parseHtml(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));

const mailDoc = load('task-email-group.html');
const task = readTask(mailDoc);

test('a mail form is its fields plus the app’s own control', () => {
  assert.ok(task, 'EmailToGroupForm is a task');
  assert.equal(task.kind, 'task');
  assert.equal(task.title, 'Email to Group');

  assert.deepEqual(task.rows.map((r) => r.label),
    ['From', 'Send to', 'Subject', 'Message', 'Attach', 'Send a copy to myself']);
  assert.equal(task.fields.length, 6);

  // Every control here has an href of "#" or none at all: the app's own JS.
  assert.deepEqual(task.actions.map((a) => a.label),
    ['Compose Email', 'Display family/instructor email addresses to select from']);
  assert.equal(task.actions[0].id, 'composeemail');
  assert.equal(task.actions[0].js, true);

  // The id wins over position: the app names its submit control.
  assert.equal(task.primary.label, 'Compose Email');

  // A plain link leaves this screen, so it is listed, not pressed.
  assert.deepEqual(task.links, [{ label: 'Email templates', href: 'admin.sd?page=EmailTemplates' }]);
});

test('the top bar is chrome, not a control of this page', () => {
  // The fixture carries `a#save` in the top bar; the crawl does not record it
  // (it reads the content root), and neither does the action reader.
  assert.equal(task.actions.some((a) => a.id === 'save'), false);
  assert.equal(task.actions.some((a) => a.label === 'Save'), false);
});

test('routing sends a non-record form with a control to the task view', () => {
  const page = readPage(mailDoc, 'https://app.thestudiodirector.com/studio1/admin.sd?page=EmailToGroupForm');
  assert.equal(page.view, 'task');
  assert.equal(page.title, 'Email to Group');
  assert.equal(page.task.primary.label, 'Compose Email');
  assert.equal(page.sheet, null);
  assert.equal(page.index, null);
});

test('pressing a control writes only the edits, then clicks the app’s element', () => {
  const live = load('task-email-group.html');
  let clicks = 0;
  live.getElementById('composeemail').addEventListener('click', (e) => {
    e.preventDefault();
    clicks += 1;
  });

  const values = {};
  for (const field of task.fields) {
    values[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }
  values.subject = 'Recital times';
  values.copy = false;

  const result = runTaskInApp(live, task, values);
  assert.equal(result.submitted, true);
  assert.equal(result.reason, 'ok');
  assert.deepEqual(result.applied.sort(), ['copy', 'subject']);
  assert.equal(clicks, 1, 'the app decides what the request is');

  assert.equal(live.getElementById('subject').getAttribute('value'), 'Recital times');
  assert.equal(live.getElementById('copy').hasAttribute('checked'), false);
  assert.equal(live.getElementById('group').value, 'all', 'untouched fields are left alone');
});

test('an unedited form still presses the control: defaults are a valid request', () => {
  const live = load('task-email-group.html');
  let clicks = 0;
  live.getElementById('composeemail').addEventListener('click', (e) => {
    e.preventDefault();
    clicks += 1;
  });

  const values = {};
  for (const field of task.fields) values[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;

  const result = runTaskInApp(live, task, values);
  assert.deepEqual(result.applied, []);
  assert.equal(result.submitted, true);
  assert.equal(clicks, 1);
});

test('a control that cannot be identified is not pressed at random', () => {
  // Five identical "Cancel Class" links, one per class date: pressing one would
  // cancel a date nobody chose.
  const live = parseHtml(`<div class="contentContainer"><div class="Content">
      <table class="SimpleSD"><tr><th>Name</th></tr><tr><td>Ada</td></tr></table>
      <a href="#" onclick="StudioDir.onCallMethodSubmit('Attendance','cancelClass','a');return false;">Cancel Class</a>
      <a href="#" onclick="StudioDir.onCallMethodSubmit('Attendance','cancelClass','b');return false;">Cancel Class</a>
    </div></div>`);

  const actions = readActions(live.querySelector('.contentContainer'));
  // Offered once, not twice: five identical buttons are one control with five
  // targets, which is the reason this one cannot be pressed.
  assert.equal(actions.length, 1);
  assert.equal(actions[0].label, 'Cancel Class');

  let clicks = 0;
  for (const a of live.querySelectorAll('a')) a.addEventListener('click', (e) => { e.preventDefault(); clicks += 1; });

  const result = clickActionInApp(live, actions[0]);
  assert.equal(result.submitted, false);
  assert.equal(result.reason, 'ambiguous');
  assert.equal(result.matches, 2);
  assert.equal(clicks, 0);
});

test('a control with a unique label is pressed', () => {
  const live = load('task-email-group.html');
  const print = { label: 'Display family/instructor email addresses to select from', id: '', href: '#', js: true };

  let clicks = 0;
  for (const a of live.querySelectorAll('a')) a.addEventListener('click', (e) => { e.preventDefault(); clicks += 1; });

  const result = clickActionInApp(live, print);
  assert.deepEqual(result, { submitted: true, via: 'label', label: print.label });
  assert.equal(clicks, 1);
});

test('a form with no control of its own is left to the app', () => {
  // ManageHolidays: a Form table and a save link in the top bar, nothing else.
  const settings = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
      <div class="formTitle">Manage Holidays</div>
      <table class="Form"><tbody>
        <tr><td>Name</td><td><input id="name" type="text"></td></tr>
        <tr><td>Date</td><td><input id="date" type="text"></td></tr>
        <tr><td>Repeat</td><td><input id="repeat" type="checkbox"></td></tr>
        <tr><td>Notes</td><td><input id="notes" type="text"></td></tr>
      </tbody></table>
      <a href="admin.sd?page=ManageHolidays">Back to holidays</a>
    </div></div></form>`);

  assert.equal(readActions(settings.querySelector('.contentContainer')).length, 0);
  assert.equal(readTask(settings), null);
  assert.equal(readPage(settings, 'https://app.thestudiodirector.com/studio1/admin.sd?page=ManageHolidays').task, null);
});

test('a report is not a task, and a list is not one either', () => {
  const report = readPage(load('report-roster.html'), 'https://x/admin.sd?page=ClassRosterForm');
  assert.equal(report.view, 'report');
  assert.equal(report.task, null);

  const list = readPage(load('editor-class.html'), 'https://x/admin.sd?page=NewClass');
  assert.equal(list.view, 'list');
  assert.equal(list.task, null);
});

test('tabs, eye icons and menu toggles are parts of a page, not its controls', () => {
  // Found by re-crawling with `[onclick]` enabled: the record tabs, the password
  // eye icons and in-place phone labels all carry an onclick, and reading them
  // as controls would have put "Overview / Enrollment / Skills" in a button row.
  const doc = parseHtml(`<div class="contentContainer"><div class="Content">
      <div class="tabContainer">
        <div id="tab-overview" class="tab selectedTab" onclick="StudioDir.selectTab('tab-overview')">Overview</div>
        <div id="tab-skills" class="tab" onclick="StudioDir.selectTab('tab-skills')">Skills</div>
      </div>
      <span id="currPassEyeIcon" class="table-field-icon" onclick="StudioDir.togglePassword('a','b')"></span>
      <div class="menuButton"><a class="menuLink" href="#"><span>More</span></a></div>
      <div class="Btn" onclick="StudioDir.onSubmit('Enroll');">Enroll</div>
    </div></div>`);

  const actions = readActions(doc.querySelector('.contentContainer'));
  assert.deepEqual(actions.map((a) => a.label), ['Enroll'],
    'the app\'s div button is a control; nothing else is');
  assert.equal(actions[0].js, true);
});

test("the primary control prefers the app's own id over page order", () => {
  const box = (html) => parseHtml(`<div class="contentContainer">${html}</div>`).querySelector(".contentContainer");

  // EmailClasses: two selection helpers and no named submit, so the page's own
  // order decides.
  assert.equal(primaryAction(readActions(box(`
      <a href="#">Select by Filter</a>
      <a href="#">Select by Instructor</a>`))).label, "Select by Filter");

  // With a named control, the name wins even when it comes second.
  assert.equal(primaryAction(readActions(box(`
      <a href="#">Email all past due</a>
      <a id="composeemail" href="#">Compose Email</a>`))).label, "Compose Email");
});
