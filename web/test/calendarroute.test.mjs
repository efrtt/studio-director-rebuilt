// Which URLs are calendar pages, not records.
//
// Reported from the live 2026 Sign Ups calendar: Week went to the app's own
// page, and a week that did have classes came back as a two-row table.
//
// The cause was in `isRecordPage`, which calls any query parameter it does not
// recognise a record id. The calendar's own parameters - `SEASON`,
// `DATESPEC_VIEW`, `DATESPEC_VIEW_DATE` - are not record ids: they say which
// week or season to draw. Every dated calendar URL therefore took the record
// path, and there the compact week grid (`table.WeekCal`) was read as a data
// table, because only `TimeBlock` was on the sheet reader's "not data" list.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { isRecordPage } from '../src/lib/shell.js';
import { readSheet } from '../src/lib/sheet.js';

const BASE = 'https://app.thestudiodirector.com/srvda/admin.sd';
const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

test('a dated calendar URL is not a record page', () => {
  assert.equal(isRecordPage(`${BASE}?page=CalendarPage&DATESPEC_VIEW_DATE=2026-08-24`), false);
  assert.equal(isRecordPage(`${BASE}?page=CalendarPage&SEASON=2026+Sign+Ups`), false);
  assert.equal(isRecordPage(`${BASE}?page=CalendarPage&DATESPEC_VIEW=WEEK&SEASON=2026+Sign+Ups`), false);
});

test('a record URL still is one', () => {
  assert.equal(isRecordPage(`${BASE}?page=EditStudent&fident=123`), true);
  assert.equal(isRecordPage(`${BASE}?page=EditClass&cident=1782910697458`), true);
  assert.equal(isRecordPage(`${BASE}?page=EditClass&cident=1&class_day=2026-08-24`), true);
  assert.equal(isRecordPage(`${BASE}?page=EditFamily`), true, 'the page name alone counts');
});

test('a week or month grid is never read as a data table', () => {
  const week = doc(`<body><div id="mainContent"><table class="WeekCal"><tbody>
    <tr><th colspan="4">Monday 8/24</th><th colspan="4">Tuesday 8/25</th><th colspan="4">Wednesday 8/26</th>
      <th colspan="4">Thursday 8/27</th><th colspan="4">Friday 8/28</th><th colspan="4">Saturday 8/29</th><th colspan="4">Sunday 8/30</th></tr>
    <tr><td>3:00 - 4:15</td><td><a href="admin.sd?page=EditClass&cident=1"><span class="openClass">Jazz</span></a></td><td></td><td>GI</td></tr>
  </tbody></table></div></body>`);
  assert.equal(readSheet(week), null, 'the week calendar has its own view');

  const month = doc(`<body><div id="mainContent"><table class="MonthCal"><tbody>
    <tr><th>Sunday</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th></tr>
    <tr><td class="Empty"></td><td class="Weekday"><div><a href="x">1</a></div></td><td class="Weekday"><div><a href="y">2</a></div></td>
      <td class="Weekday"><div><a href="z">3</a></div></td><td class="Weekday"><div><a href="w">4</a></div></td>
      <td class="Weekday"><div><a href="v">5</a></div></td><td class="WeekendDay"><div><a href="u">6</a></div></td></tr>
  </tbody></table></div></body>`);
  assert.equal(readSheet(month), null, 'the month calendar has its own view');
});
