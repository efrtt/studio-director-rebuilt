// The class calendar's month view.
//
// Same page name as the week (`page=CalendarPage`), same season picker, a
// different grid. Read from the live page, where it is `table.MonthCal`:
//
//   <table class="MonthCal">
//     <tr><th>Sunday</th><th>Monday</th> … <th>Saturday</th></tr>
//     <tr>   one row per week, seven <td> each
//
// A day cell is a stack of <div>s inside its <td>:
//
//   <td class="Weekday">
//     <div><a href="…&DATESPEC_VIEW_DATE=2026-08-07">7</a></div>      the date
//     <div title="TA and Sub Training …"><a href="admin.sd?page=EditClass…">
//       <span class="openClass">1:00 - 2:00 TA and Sub Training</span></a></div>
//     <div class="MoreLink" onclick="…">More...</div>    the app's own show-more
//     <div class="MoreInfo"> … the events it was hiding … </div>
//   </td>
//
// The date is a link to the app's daily view and each event is a link to the
// class editor. `MoreInfo` is already in the DOM, so the rebuild shows every
// event and never needs a "More..." control of its own.
//
// The `title` on an event's div is the app's own tooltip — description,
// instructor, ages, slots — so it is carried through whole and shown on hover.
//
// Reading it as anything else is what the skin used to do: the grid became a
// five-row table of dates with events spilling out of their cells.

import { qs, qsa, textOf, titleOf, breadcrumbOf } from './shell.js';
import { CONTENT_INFO } from '../model/appdom.js';
import { gridTable, monthWeeks } from '../model/regions.js';

const WEEKDAY = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i;
const MONTH_LABEL = /^([A-Z][a-z]{2,9})\s+(\d{4})$/;
const DATE_ONLY = /^\d{1,2}$/;
// "1:00 - 2:00 TA and Sub Training", "12:00 PM - 1:00 PM Foo". A cancelled or
// all-day line has no leading time, and is left whole.
const SPAN = /^(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\s*[-\u2013\u2014]\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\s+(.+)$/i;

// The weekday heading row, when this table is a month grid.
function headingRow(table) {
  const head = qsa(table, 'tr')[0];
  if (!head) return null;
  const cells = qsa(head, 'th');
  if (cells.length !== 7) return null;
  const labels = cells.map((cell) => textOf(cell).replace(/\s+/g, ' ').trim());
  return labels.every((label) => WEEKDAY.test(label)) ? labels : null;
}

// The app's grid marks its own cells, so a report that happens to head seven
// weekday columns is not mistaken for a calendar.
function hasDayCells(table) {
  return qsa(table, 'td').some((td) => /(^|\s)(Empty|Weekday|WeekendDay)(\s|$)/.test(String(td.className || '')));
}

function timeOf(label) {
  const text = String(label || '').replace(/\s+/g, ' ').trim();
  const match = text.match(SPAN);
  if (!match) return { time: '', text };
  return { time: match[1].replace(/\s+/g, ' ').trim(), text: match[2].trim() };
}

const BLANK = { day: null, href: null, weekend: false, events: [], notes: [], holiday: null };

function dayOf(td) {
  if (!td) return { ...BLANK };
  const cls = String(td.className || '');
  if (/(^|\s)Empty(\s|$)/.test(cls)) return { ...BLANK };
  const weekend = /WeekendDay/.test(cls);

  const anchors = qsa(td, 'a[href]');

  // The date is the cell's own first link: a bare number pointing at the day.
  const dateAnchor = anchors.find((a) => DATE_ONLY.test(textOf(a).trim())) || null;
  let day = null;
  let href = null;
  if (dateAnchor) {
    day = Number(textOf(dateAnchor).trim());
    href = dateAnchor.getAttribute('href') || null;
  } else {
    const match = textOf(td).trim().match(/^(\d{1,2})\b/);
    if (match) day = Number(match[1]);
  }
  if (day == null) return { ...BLANK };

  // Everything else that links is an event. The first may be inside MoreInfo,
  // which is exactly the point: it is on the page, so it is read.
  const events = [];
  const seen = new Set();
  for (const anchor of anchors) {
    if (anchor === dateAnchor) continue;
    const label = textOf(anchor).replace(/\s+/g, ' ').trim();
    if (!label) continue;
    const link = anchor.getAttribute('href') || '';
    const key = `${link}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const holder = anchor.closest ? anchor.closest('div[title]') : null;
    const parts = timeOf(label);
    events.push({
      label,
      text: parts.text,
      time: parts.time,
      href: link,
      title: holder ? holder.getAttribute('title') || '' : ''
    });
  }

  // Words printed on the day that link nowhere: a holiday, a closed day.
  const notes = [];
  for (const div of qsa(td, 'div')) {
    if (/MoreLink|MoreInfo/.test(String(div.className || ''))) continue;
    if (qsa(div, 'a').length) continue;
    const text = textOf(div).replace(/\s+/g, ' ').trim();
    if (text && !DATE_ONLY.test(text) && !notes.includes(text)) notes.push(text);
  }

  return { day, href, weekend, events, notes, holiday: notes[0] || null };
}

export function readMonth(doc) {
  if (!doc || !doc.querySelectorAll) return null;

  // The grid, its weekday headings and its week rows are the page-wide row
  // judgement's (`monthWeeks`), not this reader's: this only turns each cell it
  // is given into a day.
  const grid = monthWeeks(doc);
  if (!grid) return null;
  const weekdays = grid.weekdays;

  const weeks = grid.weeks.map((cells) => cells.map((cell) => dayOf(cell.el)));
  if (!weeks.length) return null;

  // The toolbar: the month's name, the way to its neighbours, the season, and
  // the app's own Daily Staff / Week links.
  // The toolbar, or the page's content root when it prints no `.contentInfo`:
  // the root comes from `model/root.js`, so a shell-free month page is scanned
  // in the same place the rest of the readers look.
  const info = qs(doc, CONTENT_INFO) || contentRoot(doc) || doc;

  let label = '';
  for (const span of qsa(info, 'span')) {
    const text = textOf(span).replace(/\s+/g, ' ').trim();
    if (MONTH_LABEL.test(text)) { label = text; break; }
  }

  const prev = { text: '', href: '' };
  const next = { text: '', href: '' };
  for (const anchor of qsa(info, 'a')) {
    const text = textOf(anchor).replace(/\s+/g, ' ').trim();
    const href = anchor.getAttribute('href') || '';
    if (!href || !/DATESPEC_VIEW_DATE/.test(href)) continue;
    if (!prev.href && /\bprev\b/i.test(text)) { prev.text = text; prev.href = href; }
    else if (!next.href && /\bnext\b/i.test(text)) { next.text = text; next.href = href; }
  }

  const views = [];
  for (const anchor of qsa(info, 'a')) {
    const text = textOf(anchor).replace(/\s+/g, ' ').trim();
    const href = anchor.getAttribute('href') || '';
    if (!/^(daily staff|week|month)$/i.test(text) || !href) continue;
    views.push({ label: text, href });
  }

  const days = weeks.flat().filter((day) => day.day != null);
  const events = days.reduce((n, day) => n + day.events.length, 0);

  return {
    kind: 'month',
    title: titleOf(doc) || 'Class Calendar',
    label,
    weekdays,
    weeks,
    days,
    prev: prev.href ? prev : null,
    next: next.href ? next : null,
    views,
    events,
    holidays: days.filter((day) => day.holiday).length,
    breadcrumb: breadcrumbOf(doc)
  };
}
