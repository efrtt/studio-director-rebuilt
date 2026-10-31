// The buttons a page offers, and how to press them on the live page.
//
// Most screens in the app are a table plus a handful of controls, and the crawl
// shows every one of them: `a#composeemail.Btn` ("Compose Email", onclick
// `StudioDir.onSubmit('SendEmail')`), `a#print` ("Print"), a bare anchor whose
// only text is "Print letters". They nearly all have no href — the app's own JS
// builds the request — so the rebuilt view cannot link to them.
//
// What it can do is press the same element a person would press. That needs a
// way to find that element again in the live document: by id when the app gives
// one, and by its exact label when the label is unique. A label that appears
// five times ("Cancel Class", once per class date) is *not* pressed: guessing
// which of five rows you meant is worse than saying "use the full page".

import { qs, qsa, textOf } from './shell.js';

// Navigation and shell furniture, never an action on the page. `#sd-root` is
// this rebuilt UI's own overlay: its buttons carry the same words as the app's
// ("Enroll"), and pressing "the one labelled Enroll" must never find ours.
const CHROME = '#sideNavBar, .topBarContainer, .topBar, .Breadcrumb, .copyright, #sd-root';

// What counts as a control. The crawl shows the app's buttons as `a.Btn` and
// `a.BtnOutln`, but the screens it builds with its own JS (the enroll step) use
// divs carrying the same classes and an `onclick`, with no href at all. Reading
// only a/button/input hid exactly those — the enroll step appeared to have no
// button to press.
//
// `[onclick]` alone is too wide, and the crawl of the fixed selector proved it:
// it also matches the record pages' tab strips (`div.tab[onclick]`), the
// password eye icons on ChangePassword, and phone-label spans that edit a number
// in place. Those are parts of a screen, not its submit: a tab is read by
// tabs.js, an icon by nothing, and a form control is read as a field. So the
// element has to look like a button, and the known non-buttons are excluded.
const CONTROL = 'a, button, input[type="submit"], input[type="button"], div[onclick], span[onclick], li[onclick], .Btn, .BtnOutln';
const NOT_ACTION = '.tab, .tabButton, .selectedTab, .table-field-icon, .menuLink, .Tooltip';

// The record panel's own pager. Its arrows are `<< Prev` / `Next >>` and belong
// to the list, not to the screen being rebuilt.
const PAGER = /^(<<\s*prev|next\s*>>|«|»)$/i;

function labelOf(el) {
  const tag = el.tagName;
  if (tag === 'INPUT') {
    return (el.getAttribute('value') || el.getAttribute('title') || '').trim();
  }
  return textOf(el);
}

function isChrome(el) {
  return !!(el.closest && el.closest(CHROME + ', #idSearchSpan'));
}

// A tab, an icon, a menu toggle: part of the page, not a control of it.
function notAnAction(el) {
  return !!(el.matches && el.matches(NOT_ACTION))
    || !!(el.closest && el.closest(NOT_ACTION));
}

// A link *inside a data table* is a row, not a control: the roster's student
// names, the size list's "Child Small". But most of these pages wrap the whole
// content in `table.Layout` — one cell, no headings — and the button bar inside
// that cell is still the page's control, not a row.
function insideDataTable(el) {
  const table = el.closest ? el.closest('table') : null;
  if (!table) return false;

  // This table's own rows only. A `table.Layout` cell can contain a second
  // table, and counting the nested one's cells would turn the layout into a
  // data table and hide the button bar inside it.
  const rows = Array.from(table.children)
    .flatMap((c) => (c.tagName === 'TBODY' || c.tagName === 'THEAD' ? Array.from(c.children) : [c]))
    .filter((r) => r.tagName === 'TR');

  return rows.some((tr) => {
    const cells = Array.from(tr.children);
    if (cells.some((c) => c.tagName === 'TH')) return true;
    return cells.filter((c) => c.tagName === 'TD').length >= 2;
  });
}

// Every candidate action on the page, in document order, minus the ones that
// are really navigation: rail links, breadcrumbs, links inside a table (those
// are rows, not controls) and the record panel's pager.
export function readActions(root) {
  const out = [];
  const seen = new Set();

  for (const el of qsa(root, CONTROL)) {
    if (insideDataTable(el)) continue;
    if (isChrome(el)) continue;
    if (notAnAction(el)) continue;
    // A wrapper that happens to carry the handler for a child (a `div` with
    // `onclick` around a real link) is not a second control: the leaf is.
    if (qsa(el, CONTROL).length) continue;

    const label = labelOf(el);
    if (!label || PAGER.test(label)) continue;

    const href = el.getAttribute && el.getAttribute('href');
    // `href="#"`, no href at all, or `javascript:StudioDir.…()` — three ways of
    // saying the app's own script is the control.
    const js = !href || href === '#' || /^javascript:/i.test(href);
    // A plain link that leaves this screen is navigation, not an action: the
    // sheet and task views already show the rail and the in-page links.
    if (!js && el.tagName === 'A') continue;

    const key = (el.id || '') + '|' + label;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      label,
      id: el.id || '',
      href: href || '',
      // The app's own script does the work (`href="#"`, or no href at all).
      js,
      // `StudioDir.onSubmit('SendEmail')` and friends: evidence of what it does,
      // never executed here.
      onclick: (el.getAttribute && el.getAttribute('onclick')) || ''
    });
  }

  return out;
}

// The one action a page is mostly about: the app names its submit controls
// (`save`, `saveandnext`, `ok`, `next`, `continue`, `composeemail`), so an id is
// the strongest signal. Otherwise the first one the page offers wins, because
// the page's own order is somebody's idea of the workflow.
const PRIMARY_IDS = ['save', 'saveandnext', 'continue', 'ok', 'next', 'composeemail', 'selectbyfilter', 'print'];

export function primaryAction(actions) {
  for (const id of PRIMARY_IDS) {
    const found = actions.find((a) => a.id === id);
    if (found) return found;
  }
  return actions[0] || null;
}

// Press an action on the *live* page. Returns what happened rather than
// claiming success, so a control that cannot be found says so.
export function clickActionInApp(doc, action) {
  if (!action) return { submitted: false, reason: 'no-action' };

  if (action.id) {
    const byId = doc.getElementById(action.id);
    if (byId && byId.tagName !== 'TABLE' && byId.tagName !== 'TBODY') {
      byId.click();
      return { submitted: true, via: 'id', id: action.id };
    }
  }

  // No id: only an unambiguous label may be pressed.
  const matches = qsa(doc, CONTROL)
    .filter((el) => !insideDataTable(el) && !isChrome(el) && !notAnAction(el))
    .filter((el) => labelOf(el) === action.label);

  if (matches.length === 1) {
    matches[0].click();
    return { submitted: true, via: 'label', label: action.label };
  }

  return {
    submitted: false,
    reason: matches.length ? 'ambiguous' : 'missing',
    matches: matches.length
  };
}

// A short note for the views: why an action is shown but not pressable.
export function actionHint(doc, action) {
  if (!action) return '';
  if (action.id && qs(doc, '#' + action.id)) return '';
  const matches = qsa(doc, CONTROL)
    .filter((el) => !insideDataTable(el) && !isChrome(el) && !notAnAction(el))
    .filter((el) => labelOf(el) === action.label);
  if (matches.length === 0) return 'not on this page';
  if (matches.length > 1) return `${matches.length} of them - use Full page`;
  return '';
}
