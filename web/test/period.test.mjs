// The calendar's season picker.
//
// Read from the live CalendarPage: a bare `<select>` in `.contentInfo` whose
// options are whole `admin.sd?page=CalendarPage&SEASON=…` URLs. That is what
// separates it from the site's other selects, whose options are labels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { readPeriodControl, choosePeriodInApp } from '../src/lib/period.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const calendar = doc(`<body><div class="contentInfo">
  <select onchange="window.location.href=StudioDir.getSelectValue(this)">
    <option value="/srvda/admin.sd?page=CalendarPage&amp;SEASON=Fall" selected>Fall 2026-Spring 2027</option>
    <option value="/srvda/admin.sd?page=CalendarPage&amp;SEASON=Sign+Ups">2026 Sign Ups</option>
  </select>
  <p>Week of October 26</p>
</div></body>`);

test('the season picker is found, with its current choice', () => {
  const period = readPeriodControl(calendar);
  assert.equal(period.label, 'Season');
  assert.equal(period.options.length, 2);
  assert.equal(period.value, '/srvda/admin.sd?page=CalendarPage&SEASON=Fall');
  assert.equal(period.current, 'Fall 2026-Spring 2027');
});

test("a form's select is not a season picker", () => {
  // The class editor's `#season` and the week fixture's picker both carry labels.
  const editor = doc('<body><table class="Form"><tr><td>Season</td><td><select id="season"><option>Fall</option><option selected>Winter</option></select></td></tr></table></body>');
  assert.equal(readPeriodControl(editor), null);

  const weekFixture = doc('<body><div class="contentInfo"><select><option>Week 1</option><option selected>Week 2</option></select></div></body>');
  assert.equal(readPeriodControl(weekFixture), null);

  assert.equal(readPeriodControl(doc('<body><p>no controls</p></body>')), null);
});

test('switching season goes through the app own control', () => {
  const seen = [];
  const select = calendar.querySelector('select');
  select.addEventListener('change', () => seen.push(select.value));

  const result = choosePeriodInApp(calendar, '/srvda/admin.sd?page=CalendarPage&SEASON=Sign+Ups');
  assert.equal(result.switched, true);
  assert.deepEqual(seen, ['/srvda/admin.sd?page=CalendarPage&SEASON=Sign+Ups']);

  // A value this page does not offer is not invented.
  assert.equal(choosePeriodInApp(calendar, '/srvda/admin.sd?page=CalendarPage&SEASON=Nope').switched, false);
});
