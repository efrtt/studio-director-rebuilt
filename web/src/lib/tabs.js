// Tab panels on a record page.
//
// A record page (EditClass, EditFamily, EditStudent, EditInstructor) is not one
// screen: it ships all of its tabs in the same HTML, every panel after the first
// hidden with `display:none`.
//
//   .tabContainer > .tab                     "Overview" "Enrollment" "Skills"
//   #tab-enrollment-content.tabContent       the panel for the tab above it
//
// That is why one fetch is enough to rebuild them all — and why the crawl could
// report them without clicking anything.
//
// The panels are tables, not forms: `table.SimpleSD` for a class roster,
// `table.ReportTable` for skills, one `table.TimeBlock` per weekday on the
// calendar tab. The table parser itself lives in `model/table.js`: a view module
// should not own the parser three other readers use.
//
// Nothing here is written back: these panels are read-only views of what the app
// already rendered. Anything that changes them ("Add student", "Add skill") is a
// JS control, listed as an action rather than faked.

import { qs, qsa, textOf } from './shell.js';
import { labelAbove } from './heading.js';
import { readTable } from '../model/table.js';

// Re-exported so a caller that already had it from here keeps working.
export { readTable };

// Text that introduces the table under it ("Waitlist"), rather than a table of
// its own.
const SECTION = '.WithinSectionSpace, .sectionHeader, .sectionTitle, h3, h4';
const MESSAGE = '.ReportTableNoItemsMsg, .NoItems, .empty';

function keyOf(id) {
  const m = /^tab-(.+?)(?:-content)?$/.exec(id || '');
  return m ? m[1] : (id || '');
}

// One panel: its tables in order, each under the section label that precedes it,
// plus the panel's own buttons and any "No skills." style message.
function panelOf(panel) {
  const blocks = [];
  const actions = [];
  let section = '';
  let note = '';

  // Tables are not always direct children: the family's Students tab wraps its
  // roster in two divs and a `MultiTable` spacer. One query in document order
  // fixes that, and keeps each table under the section label above it.
  const ordered = qsa(panel, ['table', SECTION, MESSAGE].join(', '));

  for (const el of ordered) {
    if (el.tagName === 'TABLE') {
      // A table nested inside another one's cell belongs to that table, not here.
      if (el.closest && el.closest('table') !== el) continue;
      // Not every panel classes its heading: the enrollment rows are named by
      // a bare div above the table, so the class lookup is the first guess and
      // the element above the table is the second.
      blocks.push({ section: section || labelAbove(el), ...readTable(el) });
      continue;
    }
    if (el.matches && el.matches(MESSAGE)) {
      note = textOf(el);
      continue;
    }
    if (el.matches && el.matches(SECTION)) section = textOf(el);
  }

  // The button row above a table ("Add student", "Tags").
  for (const a of qsa(panel, 'a[href]')) {
    if (a.closest && a.closest('table')) continue;
    actions.push({
      label: textOf(a),
      id: a.id || '',
      href: a.getAttribute('href'),
      // `href="#"` means the app's own JS does the work.
      js: !a.getAttribute('href') || a.getAttribute('href') === '#'
    });
  }

  // A table with headings but no rows still says what it would hold.
  for (const block of blocks) {
    if (block.rows.length || !block.headings.length) continue;
    if (!note) note = block.section ? `${block.section}: nothing here yet.` : 'Nothing here yet.';
  }

  const controls = panel.querySelectorAll('input,select,textarea,button').length;

  return {
    blocks: blocks.filter((b) => b.headings.length || b.rows.length),
    actions: actions.filter((a) => a.label),
    note,
    controls
  };
}

// The strip's own children are the tabs. The *selected* one is marked
// `class="selectedTab"` and has no `tab` class at all — on the live pages the
// first tab is exactly that — so a `.tab`-only selector silently drops it and
// shifts every label one place.
function tabElements(strip) {
  const direct = Array.from(strip.children || []).filter((el) => {
    if (/^(SCRIPT|STYLE|INPUT|SELECT|TABLE)$/.test(el.tagName)) return false;
    if (el.querySelector && el.querySelector('.tabContent')) return false;
    // An icon-only tab has no text but is still a tab: keep the app's own class.
    return !!textOf(el) || /(^|\s)(tab|tabButton|selectedTab)(\s|$)/.test(el.getAttribute('class') || '');
  });
  if (direct.length >= 2) return direct;

  return qsa(strip, '.tab, .tabButton, .selectedTab');
}

// Returns null when the page has no tab strip: an editor without tabs (or a list
// page) should not grow an empty tab bar.
export function readTabs(doc) {
  const strip = qs(doc, '.tabContainer');
  if (!strip) return null;

  const tabEls = tabElements(strip);
  if (tabEls.length < 2) return null;

  const panels = new Map();
  for (const panel of qsa(doc, '.tabContent')) panels.set(keyOf(panel.id), panel);

  const panelsInOrder = qsa(doc, '.tabContent');

  const tabs = tabEls.map((el, i) => {
    const key = keyOf(el.id);
    const label = textOf(el) || key || `Tab ${i + 1}`;
    // Matched by id when the tab has one, otherwise by position: the panels are
    // in the same order as the tabs that open them.
    const panel = (key && panels.get(key)) || panelsInOrder[i] || null;

    // The first tab is the record itself: it is the form the editor already
    // renders, not a panel to read.
    const isForm = i === 0 || /^overview$/i.test(key) || /^overview$/i.test(label);
    const read = panel && !isForm
      ? panelOf(panel)
      : { blocks: [], actions: [], note: '', controls: 0 };

    return {
      key: key || String(i),
      label,
      selected: /selectedTab|selected|active/i.test(el.getAttribute('class') || ''),
      kind: isForm ? 'form' : 'table',
      ...read
    };
  });

  return { kind: 'tabs', tabs };
}
