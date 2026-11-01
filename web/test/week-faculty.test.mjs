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
