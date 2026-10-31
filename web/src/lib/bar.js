// The record page's button bar: New, Print, Email, Delete, Edit Family, More.
//
// Confirmed by the EditStudent dump: the bar sits above the tabs, beside the
// title, and every control in it is an `<a>`:
//
//   .Content > .ButtonBar > a#new  a#save  a#print  a#email  a#delete  a#editfamily
//                          > div#menuBtn.menuButton > a.menuLink + div.menu > a…
//
// Two kinds of control, and they want opposite handling:
//
//   - one with an href (`New` -> NewStudent, `Print` -> PrintStudent&sident=…,
//     `Edit Family` -> EditFamily&fident=…) is a page the app renders, so the
//     rebuilt view simply links to it — the app reads the record id out of the
//     URL itself, and nothing here has to know which id is which;
//   - one without (`Delete` -> onclick StudioDir.onSubmit('DelStudent')) is the
//     app's own script, so it is pressed on the *live* page instead of being
//     reimplemented. See clickActionInApp in actions.js.
//
// Save is not returned as a bar item: the editor's own Save owns it, because
// that is the one that writes only the fields a person changed.

import { qs, textOf } from './shell.js';
import { actionHint } from './actions.js';

// A control that takes something away. Pressing it asks first — the app may ask
// again (it usually does), and a double question is better than a silent delete.
const DANGER = /^(delete|remove|drop)\b/i;

function itemOf(el, doc) {
  const label = textOf(el);
  if (!label) return null;

  const href = el.getAttribute('href') || '';
  const js = !href || href === '#' || /^javascript:/i.test(href);
  const id = el.id || '';

  return {
    label,
    id,
    href,
    // `StudioDir.onSubmit('DelStudent')` and friends: evidence of what pressing
    // it does, never executed from here.
    onclick: el.getAttribute('onclick') || '',
    js,
    danger: DANGER.test(label),
    // Why a JS control cannot be pressed, when it cannot: the live page is the
    // one that gets clicked, so it has to be findable there.
    hint: js ? actionHint(doc, { id, label }) : ''
  };
}

// The bar's own buttons, in the order the app puts them, minus Save and minus
// anything inside the More menu.
function barItems(bar, doc) {
  const out = [];
  const seen = new Set();

  for (const el of Array.from(bar.children || [])) {
    if (el.tagName !== 'A' && el.tagName !== 'BUTTON') continue;
    // The menu's own toggle is not an action of the record; it opens the menu.
    if (el.matches && el.matches('.menuLink')) continue;

    const item = itemOf(el, doc);
    if (!item) continue;
    if (item.id === 'save' || /^save$/i.test(item.label)) continue;

    const key = item.id + '|' + item.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function menuItems(bar, doc) {
  // `#menuBtn` is the id the dump shows; the class is what the page also puts
  // on it, and a menu without either is not a menu.
  const menuRoot = qs(bar, '#menuBtn, .menuButton');
  if (!menuRoot) return { label: '', items: [], root: menuRoot };

  const panel = qs(menuRoot, '.menu');
  const items = [];
  const seen = new Set();

  for (const el of panel ? Array.from(panel.querySelectorAll('a, button')) : []) {
    const item = itemOf(el, doc);
    if (!item) continue;
    const key = item.id + '|' + item.label + '|' + item.href;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return {
    label: textOf(qs(menuRoot, '.menuLink')) || 'More',
    items,
    root: menuRoot
  };
}

// Returns { items, menu, moreLabel } or null when the page has no bar at all
// (a print sheet, a list, the login screen): those views must not grow buttons
// the page never had.
export function readBar(doc) {
  const bar = qs(doc, '.ButtonBar');
  if (!bar) return null;

  const items = barItems(bar, doc);
  const menu = menuItems(bar, doc);

  if (!items.length && !menu.items.length) return null;

  return {
    kind: 'bar',
    items,
    menu: menu.items,
    moreLabel: menu.label
  };
}
