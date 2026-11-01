/*
 * The generic report screen.
 *
 * ~90 report pages in the app share one shape: a `table.Form` of filters and a
 * single run control. These tests pin the reader and — the part that matters —
 * that running writes the filters and presses the app's own control instead of
 * posting anything itself.
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
const { readReport, reportTrigger, runReportInApp } = await import('../src/lib/report.js');
const { readPage } = await import('../src/lib/page.js');

const load = (name) => parseHtml(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));

const reportDoc = load('report-roster.html');
const resultsDoc = load('report-results.html');
const report = readReport(reportDoc);

test('a report page is its filters plus its run control', () => {
  assert.equal(report.kind, 'report');
  assert.equal(report.title, 'Class Roster');
  assert.equal(report.trigger.label, 'Run Report');
  assert.equal(report.trigger.id, 'runreport');
  assert.equal(report.trigger.js, true, 'the run control has no href');

  // Seven rows: season, name, type, studio, instructor, days, enrolled.
  assert.equal(report.rows.length, 7);
  assert.deepEqual(report.rows.map((r) => r.label),
    ['Season', 'Class Name', 'Class Type', 'Location', 'Instructor', 'Day', 'Enrolled']);

  // The weekday checkboxes keep their Sun..Sat labels, not the app's ids.
  const days = report.rows[5].fields;
  assert.equal(days.length, 7);
  assert.deepEqual(days.map((f) => f.label), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  assert.ok(days.every((f) => f.type === 'checkbox'));

  assert.equal(report.results.tables.length, 1);
  assert.equal(report.results.rows, 0, 'the fixture has only the heading row');
});

test('the reader routes a report page to the report view', () => {
  const page = readPage(reportDoc, 'https://app.thestudiodirector.com/studio1/admin.sd?page=ClassRosterForm');
  assert.equal(page.view, 'report');
  assert.equal(page.title, 'Class Roster');
  assert.equal(page.list, null);
  assert.equal(page.week, null);
});

test('a page that has already run shows its rows, and keeps its links', () => {
  const page = readPage(resultsDoc, 'https://app.thestudiodirector.com/studio1/admin.sd?page=ClassRosterResults');
  assert.equal(page.view, 'report');

  const done = page.report;
  assert.equal(done.trigger, null, 'a results page carries no run control');
  assert.equal(done.results.rows, 3);
  assert.deepEqual(done.results.tables[0].headings,
    ['Class', 'Day', 'Time', 'Instructor', 'Enrolled']);
  assert.equal(done.results.tables[0].rows[0][0].text, 'Ballet III');
  assert.equal(done.results.tables[0].rows[0][0].href, 'admin.sd?page=EditClass&cident=101');
  assert.equal(done.results.tables[0].rows[0][4].right, true, 'the count column keeps its alignment');
});

test('a settings form is not a report', () => {
  const settings = parseHtml(`<form id="idForm"><div class="contentContainer">
    <div class="Content"><div class="formTitle">Manage Holidays</div>
      <table class="Form"><tbody>
        <tr><td>Name</td><td><input id="name" type="text" value=""></td></tr>
        <tr><td>Date</td><td><select id="date"><option>1</option></select></td></tr>
        <tr><td>Repeat</td><td><input id="repeat" type="checkbox"></td></tr>
        <tr><td>Notes</td><td><input id="notes" type="text" value=""></td></tr>
      </tbody></table>
      <a id="save" href="#">Save Changes</a>
    </div></div></form>`);

  assert.equal(reportTrigger(settings), null, 'no run control, no report');
  assert.equal(readReport(settings), null);

  // It is a form with its own Save Changes control, so it is a task — never a
  // report grown around a button it does not have.
  const page = readPage(settings, 'https://app.thestudiodirector.com/studio1/admin.sd?page=ManageHolidays');
  assert.equal(page.view, 'task');
  assert.equal(page.task.primary.label, 'Save Changes');
  assert.equal(page.report, null);
});

test('running writes the changed filters and presses the app\'s own control', () => {
  // A live document, because that is the page the app's handlers sit on.
  const live = load('report-roster.html');
  let clicks = 0;
  live.getElementById('runreport').addEventListener('click', (e) => {
    e.preventDefault();
    clicks += 1;
  });

  const values = {};
  for (const field of report.fields) {
    values[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }
  values.classes_name = 'Ballet';
  values.classes_type = 'Jazz';
  values.classes_day__2 = true;

  const result = runReportInApp(live, report, values);
  assert.equal(result.submitted, true);
  assert.equal(result.applied.length, 3);
  assert.equal(clicks, 1, 'the app\'s own control was pressed');

  assert.equal(live.getElementById('classes_name').getAttribute('value'), 'Ballet');
  assert.equal(live.getElementById('classes_day__2').hasAttribute('checked'), true);
  const selected = Array.from(live.getElementById('classes_type').querySelectorAll('option'))
    .filter((o) => o.hasAttribute('selected')).map((o) => o.textContent);
  assert.deepEqual(selected, ['Jazz']);
});

test('running with untouched filters still runs: defaults are a valid report', () => {
  const live = load('report-roster.html');
  let clicks = 0;
  live.getElementById('runreport').addEventListener('click', (e) => { e.preventDefault(); clicks += 1; });

  const values = {};
  for (const field of report.fields) {
    values[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }

  const result = runReportInApp(live, report, values);
  assert.deepEqual(result.applied, []);
  assert.equal(result.submitted, true);
  assert.equal(clicks, 1);
});

test('a report whose control is missing says so instead of pretending', () => {
  const doc = load('report-roster.html');
  doc.getElementById('runreport').remove();

  const values = {};
  for (const field of report.fields) {
    values[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }

  const result = runReportInApp(doc, report, values);
  assert.equal(result.submitted, false);
  assert.equal(result.reason, 'no-trigger');
});

test('a run control drawn as a div is still found', () => {
  // Student / Class List draws its Run Report as `<div class="Btn" onclick=…>`:
  // no href and not a button element, so the header came up with no Run control
  // and the screen had no way to submit its filters.
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
    <div class="formTitle">Student / Class List</div>
    <table class="Form">
      <tr><td>Student Enrollment</td><td><select id="classes_enroll"><option>All students</option></select></td></tr>
      <tr><td>Birthday on or After</td><td>
        <select id="birth_month"><option>Oct</option></select>
        <select id="birth_day"><option>31</option></select>
        <select id="birth_year"><option>2026</option></select>
      </td></tr>
    </table>
    <div class="Btn" onclick="StudioDir.runReport()">Run Report</div>
  </div></div></form>`);

  const read = readReport(doc);
  assert.ok(read, 'the page is a report');
  assert.equal(read.trigger.label, 'Run Report');
  assert.equal(read.trigger.js, true);
  assert.deepEqual(read.rows.map((r) => r.label), ['Student Enrollment', 'Birthday on or After']);
  // The three date parts stay one filter row, in order.
  assert.deepEqual(read.rows[1].fields.map((f) => f.key), ['birth_month', 'birth_day', 'birth_year']);
});
