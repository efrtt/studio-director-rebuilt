// Landing pages: Charges & Payments, Communications, Advanced Search, Reports,
// Settings.
//
// The crawl says what these are: zero tables, zero form rows, and 20-60 links
// that all go somewhere real (`->NewFamilyCharge`, `->ClassRosterForm`, …). They
// are menus, and the app draws them as bare anchors — a wall of blue text with
// no way to find anything in it.
//
// So this reader does not try to understand the page's layout. It collects the
// links, keeps the label the app gives them, and groups them by the nearest
// heading above them, which is how the app already sections them ("Charges",
// "Payments", "Reports"). The rebuilt view is one searchable list of tiles.
//
// A page with a table of rows is not a menu (the Home dashboard's schedule, the
// Alerts list), and a page with a form is not one either — those keep whatever
// view they already have.

import { qs, qsa, textOf } from './shell.js';
import { contentRoot } from '../model/root.js';
import { CONTROLS } from '../model/controls.js';
import { rowCount } from '../model/regions.js';
import { MENU_LINKS, TABLE_ROWS } from './thresholds.js';
import { menuFor, layoutForTitle } from './menu.js';
import { groupCharges } from './charges.js';
import { groupComms } from './comms.js';

// A short menu can still be a menu when it is *drawn* as one. The count above is
// what protects the notices: fifty of them carry a sentence and one or two
// buttons, and covering those with tiles is worse than leaving the app alone.
// But `PrintClass` (3 links) and `PrintFamily` (5) are pickers, each destination
// its own `<li>` and nothing to fill in. That shape is not a notice: a notice's
// links share a paragraph, beside the sentence it is telling you.
const MIN_LIST_LINKS = 3;

// A menu has tens of links; a picker has thousands. `Enroll(cident)` is 4,271 —
// every student in the school, one link each. That is not a reason to refuse the
// page: the tiles are filterable, so what it needs is a cap on what is *drawn*,
// not on what is read. The filter still searches all 4,271.
const DRAW_LIMIT = 300;

// What can name a group. Real headings and the app's own section classes, plus a
// bold line - `Settings` prints its category titles beside their lists, as bold
// text, not as an ancestor heading.
// `h5` and `h6` are in the list because Settings uses `h6` for its category
// titles; stopping at `h4` is what made all 117 links look like one group.
const HEADING = 'h1, h2, h3, h4, h5, h6, .sectionHeader, .sectionTitle, .groupTitle';
// All the ways this app has been seen to print a category title, `b`-and-`strong`
// lines and inline bold included. Each candidate still has to pass `titled()`:
// short, no links inside, and not one link's own caption.
const HEADING_LIKE = HEADING
  + ', b, strong, [class*="Header"], [class*="Title"], [style*="font-weight"]';
// The rail and the top bar are navigation, not content; the page's own title is
// not a category, however it is marked up. Both selectors are the app's own
// vocabulary and live in `model/appdom.js`.
import { CHROME, PAGE_TITLE } from '../model/appdom.js';

// A menu page has no rows to read. The count is across the whole content, not
// per table: the week calendar is one small table per day, each holding a single
// class, so a per-table check would mistake it for a menu.

function isChrome(anchor) {
  return !!(anchor.closest && anchor.closest(CHROME + ', #idSearchSpan'));
}

// Each link's category: the nearest title *above it on the page*.
//
// This used to climb the link's ancestors looking for a heading, which works when
// the app wraps each section (`<div class="sectionBlock"><h3>Charges</h3>…`) and
// fails on the Settings menu, where the title sits beside the list instead:
// nothing above the anchors contains it, so all 113 links fell into one group
// called "Links" and the page's own categories vanished.
//
// One walk in document order finds the title wherever the app drew it, however
// deeply nested, and keeps the sections in the order the page prints them.
function sectionLabels(root) {
  const labels = new Map();
  let current = 'Links';

  function titled(el) {
    if (el.matches && el.matches(PAGE_TITLE)) return null;
    // A bold line captions the links under it, unless it is one link's own words
    // ("<li><strong>Seasons</strong></a>") - that is a label, not a section.
    if (el.closest && el.closest('a, li')) return null;
    if (el.querySelector && el.querySelector('a[href]')) return null;
    const text = textOf(el);
    return text && text.length <= 80 ? text : null;
  }

  function walk(node) {
    for (const child of node.children) {
      if (child.matches(HEADING_LIKE)) {
        const label = titled(child);
        if (label) { current = label; continue; }
      }
      if (child.tagName === 'A') {
        if (child.getAttribute('href')) labels.set(child, current);
        continue;
      }
      walk(child);
    }
  }

  walk(root);
  return labels;
}

export function readIndex(doc) {
  // Where a page's content starts is `model/root.js`'s answer, the same one every
  // other reader asks for. This had its own copy of the fallback order.
  const root = contentRoot(doc);
  if (!root) return null;

  // Rows mean this page shows data, not a menu — and which rows those are is
  // the page-wide judgement's (`model/regions.js`). This used to count `td`s
  // across every table on the page itself: a layout wrapper's cells counted as
  // rows, and a calendar's cells were read as a list of records.
  if (rowCount(doc) >= TABLE_ROWS) return null;

  const seen = new Set();
  const items = [];
  const sections = sectionLabels(root);

  for (const anchor of qsa(root, 'a[href]')) {
    if (isChrome(anchor)) continue;
    const href = anchor.getAttribute('href');
    const label = textOf(anchor);
    if (!label || !href || href === '#') continue;

    const key = href + '|' + label;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      label,
      href,
      section: sections.get(anchor) || 'Links',
      // Kept so the shape test below can ask whether this anchor is alone in its
      // own list item, which is what a picker looks like.
      li: anchor.closest ? anchor.closest('li') : null
    });
  }

  const listed = items.length >= MIN_LIST_LINKS
    && !qsa(root, CONTROLS).length
    && items.every((item) => item.li && item.li.querySelectorAll('a[href]').length === 1);

  if (items.length < MENU_LINKS && !listed) return null;

  // Groups in the order the page puts them, not alphabetical: the app's own
  // order is somebody's idea of a workflow.
  const groups = [];
  for (const item of items) {
    let group = groups.find((g) => g.label === item.section);
    if (!group) {
      group = { label: item.section, items: [] };
      groups.push(group);
    }
    group.items.push({ label: item.label, href: item.href });
  }

  // Which menu this is decides how it is drawn (lib/menu.js): the two long
  // reference pages get the grouped list, the two short ones task cards. The
  // title is the app's own name for the page, read once and used for both.
  const title = textOf(qs(doc, PAGE_TITLE)) || 'Links';
  const menu = menuFor(title);

  // Two menus are filed by the app by what a link *is* rather than by what a
  // person came to do ("Charges / Payments / Settings", "Emails / Letters /
  // Reports"); those links are regrouped into jobs. Every other menu keeps the
  // page's own headings.
  const finalGroups = menu === 'Charges & Payments'
    ? groupCharges(groups)
    : menu === 'Communications' ? groupComms(groups) : groups;

  return {
    kind: 'index',
    title,
    menu,
    layout: layoutForTitle(title),
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    groups: finalGroups,
    count: items.length,
    // How many tiles the view draws at once. The count above is every link.
    limit: DRAW_LIMIT,
    truncated: items.length > DRAW_LIMIT
  };
}
