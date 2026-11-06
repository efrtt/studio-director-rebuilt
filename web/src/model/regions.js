// Where a page's editor lives, and what each of its rows is.
//
// `readForm` used to pick its editor by a contest: group the page's form tables
// and take the group with the most fields, then rank the survivors. Every patch
// to that contest was a guess about a fact the page states plainly, and the last
// of it (the largest single form table with a four-field floor) still decided by
// a number the reader could not explain. It is gone; there is no score here.
//
// What replaced it is two questions, both asked of the page:
//
//   the region  which part of the content root holds labelled control rows?
//   the row     is this row a field, a section, a repeated record, or noise?
//
// A region is not required to be the biggest, the first, or the only one. A
// page may carry one dominant table, several small ones (a phone's three type
// selects sit in their own cell, a season's dates beside its form), or no table
// at all — a record editor printed as plain divs is read by `formFromRoot`, the
// same walk the settings card uses, because the page shape, not the tag name,
// is what says "these are fields".
//
// The one piece of app vocabulary used is the class the app itself puts on a
// form table — `Form`, `FormEx` (NewClass) and `FlexForm` (payments). That is
// not a per-site selector: it is the page's own statement that this table is a
// form, and it is kept as a named list below so a page that declares itself
// differently is a one-line addition rather than a new branch. A table with no
// such class is still read when the route says the page is a record editor and
// nothing declared itself, which is how a no-table or re-skinned editor would be
// read without a site-specific hack.

import { qsa, textOf } from '../lib/shell.js';
import { CONTROLS, controlsIn, controlOf } from './controls.js';
import { labelOfControl, leadingLabel } from './labels.js';
import { rowLabel } from './labels.js';
import { contentRoot, isHidden } from './root.js';
import { CHROME, RESULT_ITEM } from './appdom.js';

// The app's own names for "this table is a form". Data, not logic: a new app
// class is added here and every reader that asks sees it.
export const DECLARED_FORM = /^(Form|FormEx|FlexForm)$/i;

export function declaredOf(table) {
  return String((table && table.getAttribute && table.getAttribute('class')) || '')
    .split(/\s+/)
    .some((cls) => DECLARED_FORM.test(cls));
}

// Every table on the page that is inside the content root and that the page is
// actually showing. `isHidden` is the page's own statement (`table-hidden`), not
// a stylesheet guess.
export function tablesIn(doc, root) {
  return qsa(doc, 'table')
    .filter((table) => !(table.closest && table.closest('#sd-root')))
    .filter((table) => (root === doc.body || !root.contains ? true : root.contains(table)))
    .filter((table) => !isHidden(table));
}

// What one row of a table is, judged on its own cells:
//
//   field     a name and at least one control to fill in
//   section   a heading or spanning row — a band across the form, not a field
//   repeated  a row of values with no controls: a record of a list the page
//             prints beside its form (a season, a location), never a field
//   noise     a spacer, an empty row, or the record's own key in an unlabelled
//             row (`<td></td><td><input id="cident">`) — storage, not a field
//
// Nothing here looks at the other rows. A per-table majority vote is what used
// to drop a second date row, and a row's own cells are enough to classify it.
export function rowKind(tr) {
  if (!tr || isHidden(tr)) return 'noise';

  const cells = Array.from(tr.children || []).filter((c) => c.tagName === 'TD' || c.tagName === 'TH');
  if (!cells.length) return 'noise';

  const spanned = cells.some((c) => Number(c.getAttribute('colspan') || 1) > 1);
  const label = rowLabel(tr);
  const controls = qsa(tr, CONTROLS);
  const addressable = controls.some((el) => !!controlOf(el, tr.ownerDocument));

  if (!controls.length) {
    if (!label) return 'noise';
    // A span across the table, or a row of headings, is a band. A single cell is
    // only a band when it spans: a one-column table of values — the list of
    // locations the editor prints beside its form — has one cell per record, and
    // reading every one of those as a heading is why that list was not records.
    const heading = spanned || cells.every((c) => c.tagName === 'TH');
    return heading ? 'section' : 'repeated';
  }

  // Controls but no name for them: a row the app prints as storage. It is the
  // record's key, and an unlabelled row was never a field (see `rowsOf`).
  if (!label) return 'noise';

  // A row with a name and controls is a field row even when this reader cannot
  // address one of them: the row is still the page's, and the control it cannot
  // address is reported rather than silently dropped.
  return cells.length >= 2 ? 'field' : 'noise';
}

// The rows of one table, each labelled with its kind.
export function kindsOf(table) {
  const rows = [];
  for (const tr of qsa(table, 'tr')) {
    if (tr.closest && tr.closest('table') !== table) continue;
    rows.push({ tr, kind: rowKind(tr) });
  }
  return rows;
}

// Tables that hold at least one field row, in document order, whatever they are
// called. This is the structural answer to "which tables are the editor".
export function structuralFormTables(doc, root) {
  return tablesIn(doc, root).filter((table) => kindsOf(table).some((row) => row.kind === 'field'));
}

// The tables the page itself declares to be forms, in document order.
export function declaredFormTables(doc, root) {
  return tablesIn(doc, root).filter(declaredOf);
}

// The editor's regions, in the order the page puts them:
//
//   1. what the page declares (`Form`/`FormEx`/`FlexForm`), read row by row;
//   2. otherwise, when the route says this is a record editor, the tables that
//      are field-shaped by their own rows — a form that lost its class, or one
//      a skin prints differently;
//   3. otherwise nothing here, and the page is whatever else it says it is.
//
// `declaredOnly` is the answer for pages that must not be claimed by shape (a
// settings card can print a two-row label/control table); the record route
// passes its URL instead, which is the page's own statement of what it is.
export function editorRegions(doc, root, opts = {}) {
  const declared = declaredFormTables(doc, root).filter((table) => kindsOf(table).some((row) => row.kind === 'field'));
  if (declared.length) return declared;
  if (opts.routeSaysEditor) return structuralFormTables(doc, root);
  return [];
}

// What one table is, from evidence on its own rows. This is the universal
// question every shape asks: an editor, a report's filters, a sheet, a calendar
// grid and the chrome around them are all tables judged by the same rule.
//
//   chrome   hidden, or inside the rail / top bar / breadcrumb
//   grid     a calendar: weekday headings, day cells, or the app's own grid
//            classes (TimeBlock / WeekCal / MonthCal)
//   form     a table that is really a form: declared (`Form`, `FormEx`,
//            `FlexForm`), typed into (a select/textarea/text input in it), or
//            field rows with no heading row above them
//   data     records: a heading row, or repeated rows of values
//   noise    spacers, empty layout tables
const TYPED = 'select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])';
const MONTH_CAL = /^MonthCal$/i;
const WEEK_CAL = /^WeekCal$/i;
const DAY_SECTION = /^TimeBlock$/i;
const FORM_GRID = /^WeekdayCheckboxes$/i;
const WEEKDAY = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i;

function headingCells(table) {
  const first = qsa(table, 'tr')[0];
  return first ? Array.from(first.children || []).filter((c) => c.tagName === 'TH') : [];
}

// A calendar grid, whatever the page calls it. A month grid is a seven-cell
// weekday heading over day cells; the week's own tables carry the app classes.
export function gridKind(table) {
  // A record page's Calendar *tab* ships hidden calendar tables; they belong to
  // the tab, not to the page's week or month view, so they are not its grid.
  if (table && table.closest && table.closest('.tabContent')) return '';
  const cls = String((table && table.getAttribute && table.getAttribute('class')) || '').trim();
  if (MONTH_CAL.test(cls)) return 'month';
  if (WEEK_CAL.test(cls)) return 'week';
  if (DAY_SECTION.test(cls)) return 'day';
  if (FORM_GRID.test(cls)) return 'form';
  // Seven weekday headings are not enough: a seven-column report prints them
  // too. A month is a grid whose own cells are days (the app's `Empty` /
  // `Weekday` / `WeekendDay`), which is the row evidence the report lacks.
  const head = headingCells(table);
  const weekdayHead = head.length === 7 && head.every((cell) => WEEKDAY.test(textOf(cell).trim()));
  const dayCell = qsa(table, 'td').some((td) => /(^|\s)(Empty|Weekday|WeekendDay)(\s|$)/.test(String(td.className || '')));
  return dayCell || (weekdayHead && dayCell) ? 'month' : '';
}

function kindsCount(rows) {
  const counts = { field: 0, section: 0, repeated: 0, noise: 0 };
  for (const row of rows) counts[row.kind] += 1;
  return counts;
}

export function tableKind(table) {
  if (!table || isHidden(table)) return 'chrome';
  if (table.closest && table.closest(CHROME)) return 'chrome';
  const grid = gridKind(table);
  if (grid === 'month' || grid === 'week' || grid === 'day') return 'grid';
  if (grid === 'form') return 'form';
  if (declaredOf(table)) return 'form';
  // A table that wraps other tables is the page's layout. Its own framing rows
  // would otherwise be counted as records beside the real ones inside it.
  if (qsa(table, 'table').length) return 'noise';
  // Typed-into tables are the app's own forms whatever they are called; a row
  // of tick boxes the app has already decided (a roster) stays data.
  if (qsa(table, TYPED).length) return 'form';
  const rows = kindsOf(table);
  const counts = kindsCount(rows);
  if (counts.field && !headingCells(table).length) return 'form';
  if (headingCells(table).length || counts.repeated) return 'data';
  return 'noise';
}

// Every table of the content root, classified once, in document order. Readers
// ask this instead of carrying their own skip lists, so "which table is the
// editor / the sheet / the calendar" is one judgement for the whole page.
export function pageRegions(doc) {
  const root = contentRoot(doc);
  // Every table is judged, including one nested inside another: a printed report
  // wraps its record tables in a `Layout` table, and those inner tables are the
  // sheet. The wrapper is what gets demoted (see `tableKind`), not its content.
  const seen = root ? tablesIn(doc, root) : [];
  const tables = seen.map((table) => {
    const rows = kindsOf(table);
    return { table, rows, kind: tableKind(table) };
  });
  const counts = { form: 0, data: 0, grid: 0, chrome: 0, noise: 0 };
  const rows = { field: 0, section: 0, repeated: 0, noise: 0 };
  for (const entry of tables) {
    counts[entry.kind] += 1;
    const one = kindsCount(entry.rows);
    for (const key of Object.keys(rows)) rows[key] += one[key];
  }
  return { root, tables, counts, rows };
}

// How many rows of the page the classifier judged to be something — a field, a
// section, a record — rather than a spacer. Readers that ask "does this page
// print rows at all?" ask this, instead of counting `td`s themselves: that
// scrape counted a layout wrapper's cells as rows and kept a second answer to a
// question `pageRegions` already answers.
export function rowCount(doc) {
  return pageRegions(doc).tables.reduce(
    (n, entry) => n + entry.rows.filter((row) => row.kind !== 'noise').length,
    0
  );
}

function rootName(root) {
  if (!root) return 'none';
  if (root === root.ownerDocument.body) return 'body';
  if (root.id) return '#' + root.id;
  const cls = String(root.getAttribute('class') || '').trim().split(/\s+/)[0];
  return cls ? '.' + cls : root.tagName.toLowerCase();
}

// Which decision produced this page, recorded for the parity dump. There is one
// path now — `rowByRow` — and no fallback: the root is the app's own content
// mount, and every table is classified by its own rows. `tables` and `rows` are
// the evidence it used, so a dump can never claim the path without the counts.
export function decisionOf(doc) {
  const page = pageRegions(doc);
  const root = page.root;
  // The rebuild's own overlay is not page evidence: when the content root is
  // the document body (a print window), counting `#sd-root` would make the
  // classifier judge its own markup as tables and controls of the page.
  const mine = (el) => !(el.closest && el.closest('#sd-root'));
  const controls = root ? qsa(root, CONTROLS).filter(mine).length : 0;
  const links = root ? qsa(root, 'a[href]').filter(mine).length : 0;
  const tables = page.counts.form + page.counts.data + page.counts.grid;
  const panels = panelRegions(doc).filter((panel) => panel.counts.repeated > 0).length;
  const source = tables ? 'tables' : panels ? 'panels' : controls ? 'controls' : links ? 'links' : 'none';
  return {
    path: 'rowByRow',
    root: rootName(root),
    source,
    controls,
    links,
    tables: page.counts,
    rows: (() => {
      const rows = Object.assign({}, page.rows);
      for (const panel of panelRegions(doc)) rows.repeated += panel.counts.repeated;
      if (panels) rows.repeated = Math.max(rows.repeated, 0);
      return rows;
    })(),
    fallback: 'none'
  };
}

// The calendar grid of a given kind, classified by `pageRegions` rather than by a
// reader scanning every table on the page.
export function gridTable(doc, kind) {
  for (const entry of pageRegions(doc).tables) {
    if (entry.kind !== 'grid') continue;
    if (kind && gridKind(entry.table) !== kind) continue;
    return entry.table;
  }
  return null;
}

// All grids of a kind: seven `day` sections for the studio timeline, one `week`
// table for the compact week, one `month` table for the month.
export function gridTables(doc, kind) {
  return pageRegions(doc).tables
    .filter((entry) => entry.kind === 'grid')
    .filter((entry) => !kind || gridKind(entry.table) === kind)
    .map((entry) => entry.table);
}

// The month's rows and day cells, decided here rather than by the month reader.
// A month grid is the table `gridKind` called a month, its seven weekday
// headings are the first row, and each following seven-cell row is a week whose
// cells are either a day or a blank (`Empty`).
export function monthWeeks(doc) {
  const table = gridTable(doc, 'month');
  if (!table) return null;
  const first = qsa(table, 'tr')[0];
  const weekdays = first ? Array.from(first.children || []).filter((c) => c.tagName === 'TH').map(textOf) : [];
  if (weekdays.length !== 7) return null;
  const weeks = [];
  for (const tr of qsa(table, 'tr').slice(1)) {
    const cells = qsa(tr, 'td');
    if (cells.length !== 7) continue;
    weeks.push(cells.map((el) => ({
      el,
      kind: /(^|\s)Empty(\s|$)/.test(String(el.className || '')) ? 'blank' : 'repeated'
    })));
  }
  if (!weeks.length) return null;
  return { table, weekdays, weeks };
}

// ---- record panels ----
//
// A list page's rows are not table rows: the app prints a panel and one
// `.searchResultItem` per record. They are classified here, by the same
// evidence as a table (`repeated` = a row carrying a record and its own link),
// so a reader never scrapes links itself.
// The panel's row selector is the app's vocabulary, not this file's: it is
// declared in `appdom.js` beside the rest of it.
const PANEL_SELECTOR = '.searchResultPanel, #idSearchSpan';
const ITEM_COUNT = /^\s*(\d[\d,]*)\s+items?\s*$/i;

function itemKind(el) {
  // A row carries a record when it has words; its link is where the record
  // lives when the app gives one (a confirmation's panel does not).
  return textOf(el).trim() ? 'repeated' : 'noise';
}

export function panelRows(panel) {
  return qsa(panel, RESULT_ITEM).map((el) => ({ el, kind: itemKind(el) }));
}

// Panels are judged by their own rows and their own label: a panel that says
// "Search Results" or states a count is the result set; a panel named after one
// record type is the list carried over from the page that was searched. Ties go
// to the later panel, which is the one the app just drew.
function panelEvidence(panel) {
  const rows = panelRows(panel);
  const counts = kindsCount(rows);
  const heading = textOf((qsa(panel, '.searchResultLabel')[0]) || panel);
  let score = 0;
  if (/search/i.test(heading)) score += 3;
  if (ITEM_COUNT.test(heading.trim())) score += 2;
  const types = new Set();
  for (const row of rows) {
    const anchor = row.el.tagName === 'A' ? row.el : qsa(row.el, 'a[href]')[0];
    const href = anchor ? String(anchor.getAttribute('href') || '') : '';
    const m = href.match(/[?&]page=([A-Za-z]+)/);
    if (m) types.add(m[1].toLowerCase());
  }
  if (types.size > 1) score += 1;
  return { panel, rows, counts, score };
}

export function panelRegions(doc) {
  // A record panel can sit beside the editor rather than inside the content
  // mount (NewClass keeps its Classes panel in the side area), so panels are
  // judged across the document; the row evidence still says which one is data.
  if (!doc || !doc.querySelectorAll) return [];
  const seen = new Set();
  const out = [];
  // A panel wrapper is the usual shape; a confirmation page can print the record
  // list on its own, so a bare `.searchResultList` is its own panel. A list
  // inside a wrapper is already covered by that wrapper.
  for (const panel of qsa(doc, PANEL_SELECTOR + ', .searchResultList')) {
    if (panel.closest && panel.closest('#sd-root')) continue;
    if (seen.has(panel)) continue;
    if (panel.classList && panel.classList.contains('searchResultList')
      && panel.closest && panel.closest(PANEL_SELECTOR)) continue;
    seen.add(panel);
    out.push(panelEvidence(panel));
  }
  return out;
}

// The page's record panel: the one whose rows and label say it is the result
// set, never "the first" or "the biggest".
export function resultPanel(doc) {
  const all = panelRegions(doc);
  if (!all.length) return null;
  // A panel with rows wins; an empty one is still the result set ("no matches"),
  // which is why the empty page is read as an empty list, not as no page.
  const withRows = all.filter((p) => p.counts.repeated > 0);
  const panels = withRows.length ? withRows : all;
  let best = panels[0];
  for (const panel of panels.slice(1)) {
    if (panel.score >= best.score) best = panel;
  }
  return best;
}

// A record editor printed with no form table at all: a walk of the content root,
// grouping each control with its own label. This is the settings card's shape
// (plain divs, or a bare label/control table), which is exactly why it is a
// fallback for an editor rather than a reader of its own — the routing decides
// which screen this is, and this only decides where its fields are.
//
// Radios and same-named checkboxes are groups, as they are on the settings card;
// a record form's radio pair is one field of one row.
export function formFromRoot(doc, root, title) {
  const found = controlsIn(root, doc);
  const rows = [];
  const fields = [];
  const shown = [];
  const passed = [...found.ignored];
  const seen = new Set();

  const radioGroups = new Map();
  const checkGroups = new Map();

  for (const { el, field } of found.entries) {
    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
    const name = el.getAttribute('name') || '';
    const id = el.getAttribute('id') || '';

    if (type === 'radio') {
      const key = name || id;
      if (!key) { passed.push(el); continue; }
      if (!radioGroups.has(key)) radioGroups.set(key, []);
      radioGroups.get(key).push(el);
      continue;
    }
    if (type === 'checkbox' && name && qsa(doc, 'input[name="' + name + '"]').length > 1) {
      if (!checkGroups.has(name)) checkGroups.set(name, []);
      checkGroups.get(name).push(el);
      continue;
    }

    if (!field || seen.has(field.selector)) { passed.push(el); continue; }
    seen.add(field.selector);
    // The row's own words first (the div editor prints them beside the
    // control), then the control's ladder — and only then its id.
    const label = leadingLabel(el, root) || labelOfControl(el, doc);
    field.label = label.label;
    field.source = label.source;
    fields.push(field);
    shown.push(el);
    rows.push({ label: label.label, fields: [field] });
  }

  for (const [name, radios] of radioGroups) {
    const options = radios.map((el) => ({
      value: el.getAttribute('value') != null ? el.getAttribute('value') : '',
      label: textOf(el.closest('label')) || el.getAttribute('title') || '',
      checked: el.hasAttribute('checked')
    }));
    const chosen = options.find((o) => o.checked);
    const label = leadingLabel(radios[0], root) || labelOfControl(radios[0], doc);
    const groupLabel = label.label;
    const field = {
      key: 'radio:' + name,
      group: name,
      selector: '[name="' + name + '"]',
      id: radios[0].getAttribute('id') || '',
      name,
      type: 'radio',
      label: groupLabel || label.label || name,
      value: chosen ? chosen.value : '',
      checked: null,
      options,
      masked: false
    };
    fields.push(field);
    shown.push(...radios);
    rows.push({ label: field.label, fields: [field] });
  }

  for (const [name, boxes] of checkGroups) {
    const options = boxes.map((el) => ({
      value: el.getAttribute('value') || '',
      label: textOf(el.closest('label')) || el.getAttribute('value') || '',
      checked: el.hasAttribute('checked')
    }));
    const label = leadingLabel(boxes[0], root);
    const field = {
      key: 'checks:' + name,
      group: name,
      selector: '[name="' + name + '"]',
      id: boxes[0].getAttribute('id') || '',
      name,
      type: 'checkboxes',
      label: (label && label.label) || textOf(boxes[0].parentElement) || name,
      value: options.filter((o) => o.checked).map((o) => o.value),
      checked: null,
      options,
      masked: false
    };
    fields.push(field);
    shown.push(...boxes);
    rows.push({ label: field.label, fields: [field] });
  }

  if (!fields.length) return null;

  return {
    kind: 'form',
    title,
    breadcrumb: [],
    rows,
    fields,
    // Kept for coverage, exactly as the table reader keeps it: the caller adds
    // what the page shows that this walk did not draw.
    shown,
    passed
  };
}
