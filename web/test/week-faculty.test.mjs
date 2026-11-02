// The faculty pool, on the live calendar's own tooltip format.
//
// Lifted from the real CalendarPage: the hidden tooltip labels every line —
// "Class Name: 1", "Instructor Name: SRVDA Faculty", "Location: Stu 2". Stripping
// only "instructor:" left the label glued to the value, so the faculty rule never
// matched and the placeholder was drawn on the week.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { readWeek } from '../src/lib/calendar.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const lane = (left, code, visible, tooltip) => `
  <div style="top:60.0px;left:${left}%;width:25.0%;height:60.0px">
    <div style="background-color:#00ffff"><a href="admin.sd?page=EditClass&amp;cident=${code}"><b>3:30p</b>${visible}</a></div>
    <span>${tooltip}</span>
  </div>`;

const page = (lanes) => doc(`<body><div class="contentInfo"><div class="Content">
  <div class="formTitle">Class Calendar</div>
  <table class="TimeBlock"><tbody>
    <tr><th>Monday</th></tr>
    <tr><td>3PM</td><td><div>${lanes}</div></td></tr>
  </tbody></table>
</div></div></body>`);

test('a labelled tooltip loses its label, not its value', () => {
  const week = readWeek(page(lane(0, 806,
    'Stu 1 - 806 Pre Ballet - 4-5 - RR - 3:30 PM - 4:15 PM - 3 of 14 spots taken',
    'Class Name: Pre Ballet<br>Instructor Name: Ms. Ruiz<br>Location: Stu 1<br>11 spots available<br>0 waitlisted<br>Ages: 4-5')));

  const block = week.days[0].blocks[0];
  assert.equal(block.name, 'Pre Ballet');
  assert.equal(block.instructor, 'Ms. Ruiz', 'the label is not part of the name');
  assert.equal(block.location, 'Stu 1');
  assert.equal(week.hidden, 0);
});

test('the faculty pool is counted and left off the week', () => {
  const week = readWeek(page(
    lane(0, 806,
      'Stu 1 - 806 Pre Ballet - 4-5 - RR - 3:30 PM - 4:15 PM - 3 of 14 spots taken',
      'Class Name: Pre Ballet<br>Instructor Name: Ms. Ruiz<br>Location: Stu 1<br>11 spots available<br>0 waitlisted<br>Ages: 4-5') +
    lane(25, 12,
      'Stu 2 - 1 - 0 - Fac - 3:30 PM - 3:45 PM - 0 of 0 spots taken',
      'Class Name: 1<br>Instructor Name: SRVDA Faculty<br>Location: Stu 2<br>0 spots available<br>0 waitlisted<br>Ages: 0') +
    lane(50, 13,
      'Stu 3 - 4 - 13+ - Fac - 3:45 PM - 4:00 PM - 0 of 40 spots taken',
      'Class Name: 4<br>Instructor Name: studio1 faculty<br>Location: Stu 3<br>40 spots available<br>0 waitlisted<br>Ages: 13+')
  ));

  assert.equal(week.hidden, 2);
  assert.equal(week.days[0].blocks.length, 1);
  assert.equal(week.days[0].blocks[0].name, 'Pre Ballet');
});

// The live calendar puts the *studio* in the bold lead field, not the time:
// "<b>Stu 3</b> - 914 Tn/Ad Tap - 18+ - SB - 11:00 AM - 12:00 PM". The reader
// stripped the bold before it looked for a studio, so the label was discarded and
// these classes fell back to the lane - which on a day with one studio open is
// left:0 width:100%, i.e. studio 1. Both blocks below are studio 3 in the app.
const liveBlock = (left, code, bold, visible, tooltip) => `
  <div style="top:0.0px;left:${left}%;width:100.0%;height:119.0px">
    <div style="background-color:#19ff00;z-index:100000"><a href="admin.sd?page=EditClass&amp;cident=${code}"><b>${bold}</b>${visible}</a></div>
    <span style="display:none">${tooltip}</span>
  </div>`;

test('a bold studio label is the studio, not a class code', () => {
  const week = readWeek(page(liveBlock(0, 1782910697485, 'Stu 3',
    ' - 914 Tn/Ad Tap - 18+ - SB - 11:00 AM - 12:00 PM - 1 of 14 spots taken',
    'Class Name: 914 Tn/Ad Tap<br>Instructor Name: S. B.<br>Location: Stu 3<br>13 spots available<br>0 waitlisted<br>Ages: 18+') +
    liveBlock(0, 1782910697486, 'Stu 3',
      ' - 906 Tn/Ad Jazz - 18+ - SB - 12:00 PM - 1:00 PM - 3 of 14 spots taken',
      'Class Name: 906 Tn/Ad Jazz<br>Instructor Name: S. B.<br>Location: Stu 3<br>11 spots available<br>0 waitlisted<br>Ages: 18+')));

  const [tap, jazz] = week.days[0].blocks;
  assert.equal(tap.studio, 3, 'the bold field names the studio');
  assert.equal(jazz.studio, 3);
  assert.equal(tap.code, '', 'a studio is not a class code');
  assert.equal(tap.name, '914 Tn/Ad Tap');
  assert.equal(tap.startsAt, 11 * 60);
  assert.equal(jazz.startsAt, 12 * 60);

  // It lands in the third column even though the app drew both at left:0.
  assert.deepEqual(week.days[0].columns.map((c) => c.blocks.length), [0, 0, 2, 0]);
});

test('a studio named only in the tooltip still places the block', () => {
  const week = readWeek(page(lane(0, 12,
    ' - 812 Pointe - 13+ - RR - 3:30 PM - 4:15 PM - 2 of 10 spots taken',
    'Class Name: Pointe<br>Instructor Name: Ms. R.<br>Location: Studio 4<br>8 spots available<br>0 waitlisted<br>Ages: 13+')));

  const block = week.days[0].blocks[0];
  assert.equal(block.studio, 4);
  assert.deepEqual(week.days[0].columns.map((c) => c.blocks.length), [0, 0, 0, 1]);
});

test('the block carries the instructor’s initials', () => {
  const week = readWeek(page(liveBlock(0, 9, 'Stu 3',
    ' - 914 Tn/Ad Tap - 18+ - SB - 11:00 AM - 12:00 PM - 1 of 14 spots taken',
    'Class Name: 914 Tn/Ad Tap<br>Instructor Name: S. B.<br>Location: Stu 3<br>13 spots available<br>0 waitlisted<br>Ages: 18+')));

  const block = week.days[0].blocks[0];
  assert.equal(block.initials, 'SB');
  assert.equal(block.enrolled, '1 enrolled', 'enrolled is what has been taken, not what is left');
  assert.equal(block.meta, '11:00a–12:00p · 1 enrolled');
});

test('initials fall back to the instructor’s full name', () => {
  const week = readWeek(page(lane(0, 818,
    ' - 818 Ballet - 6-7 - - 3:45 PM - 4:30 PM - 1 of 15 spots taken',
    'Class Name: Ballet<br>Instructor Name: Ms. Rivera<br>Location: Studio 1<br>14 spots available<br>0 waitlisted<br>Ages: 6-7')));

  const block = week.days[0].blocks[0];
  assert.equal(block.initials, 'R', 'a title is not a name');
  assert.equal(block.enrolled, '1 enrolled');
});
