// The calendar toolbar: which week, and which view.
//
// Reported from the live week view: it read well but there was no way back to
// the month or on to another week, because the app's own toolbar (`<< Prev`,
// the date range, `Next >>`, `Daily Staff | Week | Month`) sat under the overlay,
// unread.
//
// Read at mount time rather than into the model: the goldens pin every model
// key, and this is chrome only the live page has.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { readCalendarNav } from '../src/lib/calnav.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

const page = (inner) => doc(`<body><div class="contentInfo">${inner}</div></body>`);

test('a week page yields its neighbours, its dates and the other views', () => {
  const nav = readCalendarNav(page(`
    <select><option value="/x/admin.sd?page=CalendarPage&SEASON=Sign+Ups" selected>2026 Sign Ups</option></select>
    <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW_DATE=2026-08-17">&lt;&lt; Prev</a>
    <span style="font-weight:bold">8/24/26 - 8/30/26</span>
    <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW_DATE=2026-08-31">Next &gt;&gt;</a>
    <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW=DAILY_STAFF">Daily Staff</a> |
    Week |
    <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW=MONTH">Month</a>`));

  assert.match(nav.prev.href, /2026-08-17/);
  assert.match(nav.next.href, /2026-08-31/);
  assert.equal(nav.range, '8/24/26 - 8/30/26', 'the week it is showing');
  assert.deepEqual(nav.views.map((v) => v.label), ['Daily Staff', 'Month'],
    'the current view is text on this page, not a link');
});

test('a month page offers the week instead, and names its month', () => {
  const nav = readCalendarNav(page(`
    <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW_DATE=2026-07-01">&lt;&lt; Prev</a>
    <span style="font-weight:bold">Aug 2026</span>
    <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW_DATE=2026-09-01">Next &gt;&gt;</a>
    <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW=DAILY_STAFF">Daily Staff</a> |
    <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW=WEEK">Week</a> | Month`));

  assert.equal(nav.range, 'Aug 2026');
  assert.deepEqual(nav.views.map((v) => v.label), ['Daily Staff', 'Week']);
});

test('a link is never mistaken for the date range', () => {
  const nav = readCalendarNav(page(`
    <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW_DATE=2026-08-17">8/17/26 - 8/23/26</a>
    <span>8/24/26 - 8/30/26</span>
    <a href="/x/admin.sd?page=CalendarPage&DATESPEC_VIEW=MONTH">Month</a>`));
  assert.equal(nav.range, '8/24/26 - 8/30/26');
});

test('the season select is not a view link', () => {
  const nav = readCalendarNav(page(`
    <select><option value="/x/admin.sd?page=CalendarPage&SEASON=Week" selected>Week</option></select>`));
  assert.equal(nav, null, 'nothing here navigates views or weeks');
});

test('a page with no toolbar has no navigation', () => {
  assert.equal(readCalendarNav(doc('<body><p>hello</p></body>')), null);
  assert.equal(readCalendarNav(null), null);
});
