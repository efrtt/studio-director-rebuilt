// A table heading that names the column the controls are in.
//
// "Actions" tells you nothing the cells below do not already say with their
// shape, and it costs the widest column in the sheet. The word stays in the
// markup for a screen reader; only the ink goes away.
export function isActionHeading(heading) {
  return /^\s*actions?\s*$/i.test(String(heading == null ? '' : heading));
}

// The words above a table that give it its name, whatever the app wraps them in.
//
// The readers know three heading shapes by class — `div.WithinSectionSpace`,
// `div.ReportTableSubtitle` and an `h3`/`h4` — which is how the settings and
// print sheets are written. The record tabs are not: a student's enrollment
// panel puts a bare `<div><span>Enrollment for Fall 2026-2027 (…)</span></div>`
// above each of its tables, so the labels were dropped and two seasons of rows
// stacked up as one unnamed block.
//
// Adding a fourth class to the selectors would miss the next one, so read the
// element that comes before the table instead: a block with words of its own
// that is not another table, not a control, and not a result line — "Total
// Hours: 11:45" sits between two tables on that same page and is nobody's
// heading.
import { textOf } from './shell.js';

// `MultiTable` is deliberately not on this list. The app uses the class for
// two different things: an empty spacer between blocks, and — on the student's
// enrollment panel — the label itself (`<div class="MultiTable">Enrollment for
// Fall 2026-Spring 2027 (8/3/26-6/10/27)</div>` above each season's table). The
// words tell them apart; the class does not.
const NOT_LABEL = /(^|\s)(ButtonBar|Tooltip|bar-link|actionIcon|tabContent|tabContainer|table-hidden|searchResult\w*)(\s|$)/i;
const NOT_HEADING = /^(totals?\b|subtotals?\b|no items\b|nothing\b)/i;
// A heading is one line. Anything longer is prose, and prose beside a table is
// a paragraph, not a name for it.
const MAX_LABEL = 120;

function readsAsLabel(el) {
  if (!el || el.tagName === 'TABLE') return '';
  // A block that holds a table or a control is structure, not a label.
  if (el.querySelector && el.querySelector('table, input, select, textarea, button')) return '';
  if (NOT_LABEL.test(String(el.getAttribute('class') || ''))) return '';
  // A row of buttons carries words too — the enrollment panel opens with
  // "Add student" and "Tags" as two `a.Btn` links above its table. A label that
  // is one link is possible; a bar of them is the app's controls.
  if (el.querySelectorAll) {
    const anchors = Array.from(el.querySelectorAll('a'));
    if (anchors.length > 1) return '';
    if (anchors.some((a) => /(^|\s)btn/i.test(a.getAttribute('class') || ''))) return '';
  }
  const words = textOf(el);
  if (!words || words.length > MAX_LABEL) return '';
  if (NOT_HEADING.test(words)) return '';
  return words;
}

export function labelAbove(table, hops = 4) {
  let node = table && table.previousElementSibling;
  let steps = 0;
  // Spacer divs (`div.MultiTable`) carry no words, so the walk passes them
  // rather than stopping on the empty box the app prints between blocks.
  while (node && steps < hops) {
    const words = readsAsLabel(node);
    if (words) return words;
    node = node.previousElementSibling;
    steps += 1;
  }
  return '';
}
