// What a reader showed, what it deliberately passed over, and what it never
// looked at.
//
// Two shipped bugs were the same failure: a reader claimed a page and rendered
// only part of it, with nothing to say so. An edit of an existing payment was
// drawn as a new one, and a page whose editor is printed as two form tables
// rendered one date. Both pages compiled, both models validated, and both golden
// models matched — because a golden is the reader's own output, so a misread that
// was captured is pinned rather than caught.
//
// Coverage is the cheap half of the answer: every control inside the content root
// that a person could type into is either shown by the screen, or consciously
// passed over by the reader (a hidden key, the record list's filter box, a select
// the app fills after the response). Anything left is `unread` — a control the
// screen does not show and no one decided to drop.
//
// This is an accounting check, not a smarter guess. It does not tell a reader
// which table is the editor; it tells you when the reader stopped early.

import { qsa } from '../lib/shell.js';
import { CONTROLS } from './controls.js';
import { NON_FIELD_TYPES } from './fields.js';
import { isHidden } from './root.js';

// What counts as a control, and which controls are never a field, are the shared
// policy: this check exists to say what a *reader* left out, not to have its own
// idea of what a field is. It had a copy of both lists, so a control could be
// plumbing to one and a shortfall to the other.

// Everything covered by another reader, or by the app's shell. The record panel
// beside an editor is the list reader's business (`filter`, `searchidx`, its own
// checkboxes), and counting it here would report every editor as short.
// Everything covered by another reader, or by the app's shell. What the page is
// not showing at all (`display:none`, `table-hidden`) is handled by `isHidden`
// separately: a hidden panel is storage, not a shortfall, while a *visible* panel
// this screen does not draw is exactly what this check is for.
const NOT_OURS = '#sideNavBar, #sd-root, .topBarContainer, .topBar, .copyright, .Breadcrumb,'
  + ' .List, #idSearchSpan, .searchResultList, .menu, .ButtonBar, .ButtonArea';

const inOurs = (el) => {
  try {
    return !(el.closest && el.closest(NOT_OURS));
  } catch (err) {
    return true;
  }
};

// `shown` and `passed` are DOM nodes, not fields: identity is exact, and a model
// never has to carry a node to be checkable.
export function coverageOf(root, shown = [], passed = []) {
  if (!root) return [];
  const taken = new Set([...(shown || []), ...(passed || [])]);
  const unread = [];

  for (const el of qsa(root, CONTROLS)) {
    if (taken.has(el)) continue;
    if (!inOurs(el)) continue;
    if (isHidden(el)) continue;

    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
    if (tag === 'input' && NON_FIELD_TYPES.has(type)) continue;

    unread.push({
      tag,
      type,
      id: el.getAttribute('id') || '',
      name: el.getAttribute('name') || ''
    });
  }

  return unread;
}

// Where coverage can live on a model. Every view shape nests its reader's model
// one level down — a record page is the form itself, a report and a task keep
// theirs under `form`, a payment screen is `payment` — so the question "what did
// this screen leave out?" is asked in one place rather than once per view. A
// reader that gains coverage is picked up here without every caller learning its
// shape.
function carriers(model) {
  const m = model || {};
  return [
    m,
    m.form,
    m.payment,
    m.settings,
    m.attendance,
    m.report && m.report.form,
    m.task && m.task.form
  ];
}

export function unreadOf(model) {
  for (const holder of carriers(model)) {
    const list = holder && Array.isArray(holder.unread) ? holder.unread : null;
    if (list && list.length) return list;
  }
  return [];
}

// The one line a screen needs to say: "this page had more than I drew".
export function unreadNote(model) {
  const list = unreadOf(model);
  if (!list.length) return '';
  return list.length === 1 ? '1 control not shown' : list.length + ' controls not shown';
}
