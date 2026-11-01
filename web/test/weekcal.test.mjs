// The compact week: `table.WeekCal`.
//
// Reported from the live 2026 Sign Ups calendar: clicking Week went to the app's
// own page, and when a week did have classes it came back as a two-row striped
// table. Both were the same cause - the week reader only knew `table.TimeBlock`,
// which is the studio-timeline layout, so `WeekCal` was left to the sheet reader
// (or to nothing at all).
//
// `WeekCal` is a single table: a heading row of seven `Monday 8/24` cells, then
// one class per row, each class occupying the four cells of its day - time,
// name, a type icon, and the location. It is a list, not a timeline.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { readWeek } from '../src/lib/calendar.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const heads = ['Monday 8/24', 'Tuesday 8/25', 'Wednesday 8/26', 'Thursday 8/27',
  'Friday 8/28', 'Saturday 8/29', 'Sunday 8/30'];

const head = `<tr>${heads.map((label) => `<th colspan="4">${label}</th>`).join('')}</tr>`;

// One class is four cells in its day's group; the other days stay empty.
const blank = (n) => '<td></td>'.repeat(n);
const klass = ({ name, time, place, href, title }) => `<td title="${title}"><a href="${href}">${time}</a></td>`
  + `<td title="${title}"><a href="${href}"><span class="openClass">${name}</span></a></td>`
  + `<td title="${title}"><a href="${href}"><img title="icon"></a></td>`
  + `<td title="${title}"><a href="${href}">${place}</a></td>`;

const week = (rows) => doc(`<body><div class="contentInfo"><p>8/31/26 - 9/6/26</p></div>
  <table class="WeekCal"><tbody>${head}${rows.map((r) => `<tr>${r}</tr>`).join('')}</tbody></table></body>`);

const emptyWeek = week([]);

const oneClass = week([
  blank(20) + klass({
    name: 'Jazz Master Class w/ Tash Marconi',
    time: '3:00 - 4:15',
    place: 'GI',
    href: 'admin.sd?page=EditClass&cident=1784131329963',
    title: 'Jazz Master Class w/ Tash Marconi (Ages 9+; Jazz 3-7) \nAges: 9+ \nType: *Master Class/Workshop \nAvail: 22 of 40 slots filled \nWaitlisted: 0'
  }) + blank(4)
]);

const fullClass = week([
  klass({
    name: 'Company Audition',
    time: '3:00 - 3:30',
    place: 'Stu 1',
    href: 'admin.sd?page=EditClass&cident=1',
    title: 'Company Audition \nAvail: 20 of 20 slots filled \nWaitlisted: 3'
  })
]);

test('an empty week is still a week, with all seven days', () => {
  const model = readWeek(emptyWeek);
  assert.ok(model, 'the compact grid is a week');
  assert.equal(model.layout, 'list');
  assert.equal(model.days.length, 7);
  assert.deepEqual(model.days.map((d) => d.label), heads);
  assert.deepEqual(model.days.map((d) => d.rows.length), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(model.totals.classes, 0);
});

test('a class is read from its day’s four cells, with its time and location', () => {
  const model = readWeek(oneClass);
  assert.equal(model.totals.classes, 1);
  const saturday = model.days[5];
  assert.equal(saturday.label, 'Saturday 8/29');
  assert.equal(saturday.rows.length, 1);

  const row = saturday.rows[0];
  assert.equal(row.time, '3:00 - 4:15');
  assert.equal(row.name, 'Jazz Master Class w/ Tash Marconi');
  assert.equal(row.location, 'GI', 'the fourth cell is the location');
  assert.match(row.href, /cident=1784131329963/);
  assert.ok(row.details.some((line) => /Ages: 9\+/.test(line)), 'the app’s tooltip is kept');
  assert.equal(model.days[0].rows.length, 0, 'the other days stay empty');
});

test('availability becomes spots left and a status', () => {
  const model = readWeek(oneClass);
  const row = model.days[5].rows[0];
  assert.equal(row.spotsLeft, 18, '22 of 40 filled leaves 18');
  assert.equal(row.status, 'open');
  assert.equal(model.totals.spots, 18);

  const full = readWeek(fullClass).days[0].rows[0];
  assert.equal(full.spotsLeft, 0);
  assert.equal(full.status, 'full');
  assert.equal(full.waitlisted, 3);
});

test('the week’s own date range and title are kept', () => {
  const model = readWeek(oneClass);
  assert.equal(model.week, '8/31/26 - 9/6/26');
  assert.equal(model.kind, 'week');
});

test('a page with no calendar at all is not a week', () => {
  assert.equal(readWeek(doc('<body><table class="ReportTable"><tbody><tr><td>1</td></tr></tbody></table></body>')), null);
});

test('the studio timeline still reads as a timeline', () => {
  const timeline = doc(`<body><table class="TimeBlock"><tbody>
    <tr><th colspan="2">Monday</th></tr>
    <tr><td>3PM</td><td><div style="top:0px;left:0%;width:25%;height:60px">
      <div style="background-color:#00ffff"><a href="admin.sd?page=EditClass&cident=9">Stu 1 - Ballet - 3:45 PM - 4:30 PM - 3 of 9 spots taken</a></div>
      <span>Class Name: Ballet<br>Instructor Name: Rivera<br>Location: Stu 1<br>6 spots available<br>0 waitlisted<br>Ages: 6-7</span>
    </div></td></tr>
  </tbody></table></body>`);
  const model = readWeek(timeline);
  assert.ok(model);
  assert.equal(model.layout, undefined, 'the timeline keeps its studio columns');
  assert.equal(model.totals.classes, 1);
  assert.ok(model.days[0].columns.length >= 4);
});
