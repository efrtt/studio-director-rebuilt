// The calendar's own toolbar, read where it lives.
//
// The app draws the way around the calendar in `.contentInfo`, above the grid:
//
//   << Prev   8/31/26 - 9/6/26   Next >>      and   Daily Staff | Week | Month
//
// The current view is plain text, so on a week page the links are Daily Staff and
// Month; on a month page they are Daily Staff and Week. Every href is the app's
// own, which is the point: switching views and stepping a week are navigations
// the app already knows how to do, and none of them is built here.
//
// Deliberately not part of the model. The reader contract is `(doc, url) ->
// model`, the goldens pin every model key, and this is chrome that only the live
// page has — the same reason the season picker and the nav icons are read at
// mount time.

import { CONTENT_INFO } from '../model/appdom.js';

const VIEW_LINK = /^(daily staff|week|month)$/i;
// The dates the toolbar is showing: "8/24/26 - 8/30/26" for a week, "Aug 2026"
// for a month.
const RANGE = /^(\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-\u2013]\s*\d{1,2}\/\d{1,2}\/\d{2,4})$/;
const MONTH = /^([A-Z][a-z]{2,9}\s+\d{4})$/;

function textOfAnchor(anchor) {
  return String(anchor.textContent || '').replace(/\s+/g, ' ').trim();
}

export function readCalendarNav(root) {
  if (!root || !root.querySelector) return null;
  const scope = root.querySelector(CONTENT_INFO) || root;

  let prev = null;
  let next = null;
  const views = [];

  for (const anchor of scope.querySelectorAll('a')) {
    const text = textOfAnchor(anchor);
    const href = anchor.getAttribute('href') || '';
    if (!href) continue;

    if (VIEW_LINK.test(text)) {
      if (!views.some((view) => view.label.toLowerCase() === text.toLowerCase())) {
        views.push({ label: text, href });
      }
      continue;
    }

    // "<< Prev" and "Next >>": the arrows are part of the label, so the word is
    // what is matched, not the start of the string.
    if (!prev && /\bprev\b/i.test(text)) { prev = { text, href }; continue; }
    if (!next && /\bnext\b/i.test(text)) { next = { text, href }; }
  }

  // The label between the arrows. Only text that names a span of dates counts,
  // and never a link: the arrows themselves carry dates in their hrefs.
  let range = '';
  for (const el of scope.querySelectorAll('span, b, strong, p, div')) {
    if (el.querySelector('a')) continue;
    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 40) continue;
    const match = text.match(RANGE) || text.match(MONTH);
    if (match) { range = match[1]; break; }
  }

  if (!prev && !next && !views.length) return null;
  return { prev, next, views, range };
}
