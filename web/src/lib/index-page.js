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

import { qs, qsa, textOf, pageName } from './shell.js';

const MIN_LINKS = 6;

// A short menu can still be a menu when it is *drawn* as one. The count above is
// what protects the notices: fifty of them carry a sentence and one or two
// buttons, and covering those with tiles is worse than leaving the app alone.
// But `PrintClass` (3 links) and `PrintFamily` (5) are pickers, each destination
// its own `<li>` and nothing to fill in. That shape is not a notice: a notice's
// links share a paragraph, beside the sentence it is telling you.
const MIN_LIST_LINKS = 3;

// A picker is a handful of distinct destinations and almost no prose: `EmailClass`
// is four destinations in 86 characters. The text cap is the other half of the
// distinction, because `SendEmail` looks the same until you read it: five links to
// two destinations (one of them repeated four times with different parameters) and
// 194 characters of description. That page is deliberately left to the app.
const PICKER_TEXT = 160;

// A menu has tens of links; a picker has thousands. `Enroll(cident)` is 4,271 —
// every student in the school, one link each. That is not a reason to refuse the
// page: the tiles are filterable, so what it needs is a cap on what is *drawn*,
// not on what is read. The filter still searches all 4,271.
const DRAW_LIMIT = 300;
const HEADING = 'h1, h2, h3, h4, .sectionHeader, .sectionTitle, .groupTitle, strong, b';

// The rail and the top bar are navigation, not content.
const CHROME = '#sideNavBar, .topBarContainer, .topBar, .Breadcrumb, .copyright';

// A menu page has no rows to read. The count is across the whole content, not
// per table: the week calendar is one small table per day, each holding a single
// class, so a per-table check would mistake it for a menu.
const MIN_TABLE_ROWS = 2;

function isChrome(anchor) {
  return !!(anchor.closest && anchor.closest(CHROME + ', #idSearchSpan'));
}

// The heading the app puts above a group of links, if any.
function sectionOf(anchor, root) {
  let node = anchor.parentElement;
  let depth = 0;

  while (node && node !== root && depth < 6) {
    // A heading in this container, but not one that *is* a link's own caption.
    const heading = node.querySelector && node.querySelector(HEADING);
    if (heading) {
      const label = textOf(heading);
      if (label && label.length <= 80) return label;
    }
    node = node.parentElement;
    depth += 1;
  }
  return 'Links';
}

export function readIndex(doc) {
  const root = qs(doc, '.contentContainer') || qs(doc, '#mainContent') || doc.body;
  if (!root) return null;

  // Rows mean this page shows data, not a menu.
  const rows = qsa(root, 'table').reduce(
    (n, table) => n + Array.from(table.querySelectorAll('tr')).filter((tr) => tr.querySelector('td')).length,
    0
  );
  if (rows >= MIN_TABLE_ROWS) return null;

  const seen = new Set();
  const items = [];

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
      section: sectionOf(anchor, root),
      // Kept so the shape test below can ask whether this anchor is alone in its
      // own list item, which is what a picker looks like.
      li: anchor.closest ? anchor.closest('li') : null
    });
  }

  const listed = items.length >= MIN_LIST_LINKS
    && !qsa(root, 'input, select, textarea').length
    && items.every((item) => item.li && item.li.querySelectorAll('a[href]').length === 1);

  // Every destination offered once, nothing to type into, hardly any prose.
  const typeable = qsa(root, 'input, select, textarea')
    .filter((el) => String(el.getAttribute('type') || '').toLowerCase() !== 'hidden');
  const pages = items.map((item) => pageName(item.href));
  const picker = items.length >= 3 && items.length <= 5
    && new Set(pages).size === items.length
    && !typeable.length
    && textOf(root).length <= PICKER_TEXT;

  if (items.length < MIN_LINKS && !listed && !picker) return null;

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

  return {
    kind: 'index',
    title: textOf(qs(doc, '.formTitle, .ReportName, h1')) || 'Links',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    groups,
    count: items.length,
    // How many tiles the view draws at once. The count above is every link.
    limit: DRAW_LIMIT,
    truncated: items.length > DRAW_LIMIT
  };
}
