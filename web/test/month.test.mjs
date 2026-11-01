// The month view of the class calendar.
//
// Reported from the live app: the month page was being read as a sheet ("5 rows"),
// so it rendered as a striped table of dates with events spilling out of their
// cells, no way to change month, and holidays missing.
//
// The markup below is the live page's own: a `table.MonthCal` whose first row is
// the seven weekdays, whose day cells are `Empty` / `Weekday` / `WeekendDay`, and
// whose events are links inside `<div title>` wrappers. The app hides a long day
// behind `More...` — a `<div class="MoreLink">` beside a `<div class="MoreInfo">`
// that already holds the rest — so every event is on the page, and all of them
// are read.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { readMonth } from '../src/lib/month.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const date = (n, d) => `<div><a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW=DAILY_STAFF&DATESPEC_VIEW_DATE=${d}">${n}</a></div>`;
const event = (label, cident) => `<div title="${label} \nInstr: Faculty\nAges: 12+"><a href="admin.sd?page=EditClass&amp;cident=${cident}"><span class="openClass">${label}</span></a></div>`;
const empty = '<td class="Empty"></td>';
const cell = (cls, inner) => `<td class="${cls}">${inner}</td>`;
const row = (cells) => `<tr>${cells.join('')}</tr>`;

const page = (rows) => doc(`<body><div class="contentInfo">
  <select onchange="window.location.href=StudioDir.getSelectValue(this)">
    <option value="/x/admin.sd?page=CalendarPage&SEASON=Fall+2026">Fall 2026-Spring 2027 (8/3/26-6/10/27)</option>
    <option value="/x/admin.sd?page=CalendarPage&SEASON=Sign+Ups" selected>2026 Sign Ups</option>
  </select>
  <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW_DATE=2026-08-01">&lt;&lt; Prev</a>
  <span style="font-weight:bold;">Sep 2026</span>
  <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW_DATE=2026-10-01">Next &gt;&gt;</a>
  <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW=DAILY_STAFF">Daily Staff</a> |
  <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW=WEEK">Week</a> | Month
  <table class="MonthCal"><tbody>
    <tr><th>Sunday</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th></tr>
    ${rows.join('')}
  </tbody></table>
</div></body>`);

const calendar = page([
  // September 2026 starts on a Tuesday.
  row([empty, empty,
    cell('Weekday', date(1, '2026-09-01')),
    cell('Weekday', date(2, '2026-09-02')),
    cell('Weekday', date(3, '2026-09-03')),
    cell('Weekday', date(4, '2026-09-04')),
    cell('WeekendDay', date(5, '2026-09-05'))]),
  row([
    cell('WeekendDay', date(6, '2026-09-06')),
    cell('Weekday', `${date(7, '2026-09-07')}<div><strong>Labor Day</strong></div>`),
    cell('Weekday', date(8, '2026-09-08')),
    cell('Weekday', date(9, '2026-09-09')),
    cell('Weekday', date(10, '2026-09-10')),
    cell('Weekday', date(11, '2026-09-11')),
    cell('WeekendDay', date(12, '2026-09-12'))
  ]),
  row([
    cell('WeekendDay', date(13, '2026-09-13')),
    cell('Weekday', date(14, '2026-09-14')),
    cell('Weekday', date(15, '2026-09-15')),
    cell('Weekday', date(16, '2026-09-16')),
    cell('Weekday', date(17, '2026-09-17')),
    cell('Weekday', date(18, '2026-09-18')),
    cell('WeekendDay', date(19, '2026-09-19'))
  ]),
  row([
    cell('WeekendDay', date(20, '2026-09-20')),
    cell('Weekday', date(21, '2026-09-21')),
    cell('Weekday', [
      date(22, '2026-09-22'),
      event('1:00 - 2:00 TA and Sub Training', 1),
      event('3:45 - 4:15 Tap Prep Audition', 2),
      '<div class="MoreLink" onclick="$(this).hide();$(this).next().show();">More...</div>',
      `<div class="MoreInfo">${event('4:30 - 5:00 Tap Prep Co Audition', 3)}</div>`
    ].join('')),
    cell('Weekday', date(23, '2026-09-23')),
    cell('Weekday', date(24, '2026-09-24')),
    cell('Weekday', date(25, '2026-09-25')),
    cell('WeekendDay', date(26, '2026-09-26'))
  ])
]);

test('the weekday heading row is what makes it a month', () => {
  const month = readMonth(calendar);
  assert.ok(month, 'the page is a month');
  assert.equal(month.kind, 'month');
  assert.deepEqual(month.weekdays.slice(0, 3), ['Sunday', 'Monday', 'Tuesday']);
  assert.equal(month.weeks.length, 4);
  assert.equal(month.days.length, 26, 'the leading blanks are not dates');
  assert.equal(month.weeks[0][0].day, null);
});

test('a day keeps its date, its holiday and the app’s link to the day', () => {
  const month = readMonth(calendar);
  const flat = month.weeks.flat();

  const labor = flat.find((day) => day.day === 7);
  assert.equal(labor.holiday, 'Labor Day', 'a word printed on the day is a holiday, not an event');
  assert.equal(labor.events.length, 0);

  const plain = flat.find((day) => day.day === 8);
  assert.equal(plain.href, '/x/admin.sd?page=CalendarPage&DATESPEC_VIEW=DAILY_STAFF&DATESPEC_VIEW_DATE=2026-09-08');
  assert.equal(plain.weekend, false);
  assert.equal(flat.find((day) => day.day === 5).weekend, true);
});

test('events keep their time apart from their name and their tooltip whole', () => {
  const busy = readMonth(calendar).weeks.flat().find((day) => day.day === 22);
  assert.equal(busy.events[0].time, '1:00 - 2:00');
  assert.equal(busy.events[0].text, 'TA and Sub Training');
  assert.match(busy.events[0].href, /cident=1/);
  assert.match(busy.events[0].title, /Instr: Faculty/, 'the app’s tooltip is carried through');
  assert.equal(busy.holiday, null, 'a class time is not a holiday');
});

test('the events behind “More…” are read too, in order', () => {
  const busy = readMonth(calendar).weeks.flat().find((day) => day.day === 22);
  assert.deepEqual(busy.events.map((e) => e.text), [
    'TA and Sub Training',
    'Tap Prep Audition',
    'Tap Prep Co Audition'
  ]);
  assert.equal(busy.events[2].time, '4:30 - 5:00', 'the event the app was hiding keeps its time');
});

test('the month’s name, its neighbours, the season and the ways out are kept', () => {
  const month = readMonth(calendar);
  assert.equal(month.label, 'Sep 2026', 'the season name is not the month’s');
  assert.match(month.prev.href, /2026-08-01/);
  assert.match(month.next.href, /2026-10-01/);
  assert.deepEqual(month.views.map((v) => v.label), ['Daily Staff', 'Week']);
  assert.equal(month.events, 3);
  assert.equal(month.holidays, 1);
  assert.equal(month.title, 'Class Calendar');
});

test('a week grid is not a month', () => {
  const week = doc(`<body><table class="TimeBlock"><tbody>
    <tr><th>Monday 3PM</th><th>Tuesday 3PM</th></tr>
    <tr><td><a href="admin.sd?page=EditClass&cident=1">Ballet</a></td><td></td></tr>
  </tbody></table></body>`);
  assert.equal(readMonth(week), null);
});

test('a seven-column report is not a month', () => {
  const report = doc(`<body><table><tbody>
    <tr><th>Sunday</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th></tr>
    <tr><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td></tr>
  </tbody></table></body>`);
  assert.equal(readMonth(report), null, 'no Empty / Weekday cells, so it is a table');
});
